import { openEventStream, type StreamStatus } from "./sse";
import type {
  CancelUploadResponse,
  CompleteUploadResponse,
  InitiateUploadResponse,
  PlayResult,
  RetryStageName,
  RetryStageResponse,
  VideoListItem,
  AskResponse,
  AuthResponse,
  AdminStats,
  AdminVideosResponse,
  AdminUsersResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function fallbackMessage(status: number): string {
  if (status === 401 || status === 403) return "You're not authorized to do that. Please log in again.";
  if (status === 404) return "That wasn't found.";
  if (status >= 500) return "Something went wrong on our end. Please try again.";
  return "Something went wrong. Please try again.";
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = authHeaders();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let message = "";
    try {
      const body = await res.json();
      message = typeof body?.message === "string" ? body.message : "";
    } catch {

    }

    throw new ApiError(message || fallbackMessage(res.status), res.status);
  }

  return res.json() as Promise<T>;
}

export function initiateUpload(title: string): Promise<InitiateUploadResponse> {
  return request<InitiateUploadResponse>("/api/videos/initiate-upload", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export class UploadAbortedError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "AbortError";
  }
}

export function uploadToStorage(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadAbortedError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);

    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Storage upload failed (network/CORS). The MinIO bucket may need a CORS rule allowing this origin."
        )
      );

    xhr.onabort = () => reject(new UploadAbortedError());

    signal?.addEventListener("abort", () => xhr.abort());

    xhr.send(file);
  });
}

export function completeUpload(videoId: string): Promise<CompleteUploadResponse> {
  return request<CompleteUploadResponse>(
    `/api/videos/${videoId}/complete-upload`,
    { method: "POST" }
  );
}

export function cancelUpload(videoId: string): Promise<CancelUploadResponse> {
  return request<CancelUploadResponse>(
    `/api/videos/${videoId}/cancel-upload`,
    { method: "POST" }
  );
}

export function listVideos(): Promise<VideoListItem[]> {
  return request<VideoListItem[]>("/api/videos/get-videos");
}

export async function getPlay(videoId: string): Promise<PlayResult> {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/play`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));

  if (res.ok) {
    return {
      ready: true,
      videoId,
      title: body.title,
      status: body.status,
      progress: body.progress ?? 100,
      playbackUrl: body.playbackUrl,
      thumbnailUrl: body.thumbnailUrl,
      transcript: body.transcript,
      aiSummary: body.aiSummary,
      vectorIndex: body.vectorIndex,
    };
  }

  if (res.status === 409) {
    return {
      ready: false,
      videoId,
      status: body.status,
      progress: body.progress ?? 0,
      thumbnailUrl: body.thumbnailUrl,
      transcript: body.transcript,
      aiSummary: body.aiSummary,
      vectorIndex: body.vectorIndex,
    };
  }

  throw new ApiError(
    typeof body?.message === "string" ? body.message : fallbackMessage(res.status),
    res.status
  );
}

export function retryStage(videoId: string, stage: RetryStageName): Promise<RetryStageResponse> {
  return request<RetryStageResponse>(`/api/videos/${videoId}/retry/${stage}`, {
    method: "POST",
  });
}

export function askQuestion(videoId: string, question: string): Promise<AskResponse> {
  return request<AskResponse>(`/api/videos/${videoId}/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export function register(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getAdminStats(): Promise<AdminStats> {
  return request<AdminStats>("/api/admin/stats");
}

export function getAdminVideos(page = 1, limit = 25): Promise<AdminVideosResponse> {
  return request<AdminVideosResponse>(`/api/admin/videos?page=${page}&limit=${limit}`);
}

export function getAdminUsers(): Promise<AdminUsersResponse> {
  return request<AdminUsersResponse>("/api/admin/users");
}

export function streamAdminStats(handlers: {
  onStats: (stats: AdminStats) => void;
  onStatus?: (status: StreamStatus) => void;
}): () => void {
  return openEventStream(`${API_BASE}/api/admin/stats/stream`, {

    headers: authHeaders,
    onStatus: handlers.onStatus,
    onEvent: (event, data) => {
      if (event === "stats") handlers.onStats(data as AdminStats);
    },
  });
}

