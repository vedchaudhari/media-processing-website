import type {
  CompleteUploadResponse,
  InitiateUploadResponse,
  PlayResult,
  VideoListItem,
  AskResponse,
  AuthResponse,
  AdminStats,
  AdminVideosResponse,
  AdminUsersResponse,
} from "./types";


const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// The current JWT, set by AuthProvider (lib/auth-context.tsx) whenever it
// changes (hydrate-from-localStorage, login, register, logout). Kept as a
// plain module variable — outside React — so this plain `request()` function
// can read it without every call site having to thread the token through.
let authToken: string | null = null;

/** Called by AuthProvider whenever the logged-in user's token changes. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * An error from an API call. `.message` is always safe to show a user directly
 * (the server's message, or a friendly fallback) — it never leaks the request
 * path/status the way a raw fetch error would. `.status` is kept for callers
 * that want to branch on it (e.g. treat 401 as "session expired").
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** A human-readable fallback when the server didn't send a `message` field. */
function fallbackMessage(status: number): string {
  if (status === 401 || status === 403) return "You're not authorized to do that. Please log in again.";
  if (status === 404) return "That wasn't found.";
  if (status >= 500) return "Something went wrong on our end. Please try again.";
  return "Something went wrong. Please try again.";
}

/** Headers every authenticated request needs — shared by request() and any
 * call site (like getPlay) that has to hit fetch() directly instead of going
 * through request(), so the token is never attached in only one place. */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

/** Small wrapper around fetch that throws a user-safe ApiError on non-2xx. */
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
      /* response had no JSON body */
    }
    // Prefer the server's message (already user-facing), else a friendly
    // fallback — never the raw "Request to /path failed (status)" string.
    throw new ApiError(message || fallbackMessage(res.status), res.status);
  }

  return res.json() as Promise<T>;
}

/** Step 1: reserve a video record and get a presigned PUT URL. */
export function initiateUpload(title: string): Promise<InitiateUploadResponse> {
  return request<InitiateUploadResponse>("/api/videos/initiate-upload", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

/**
 * Step 2: upload the file straight to MinIO via the presigned URL.
 *
 * Uses XMLHttpRequest (not fetch) because only XHR exposes upload progress
 * events, which drive the progress bar. `onProgress` receives 0–100.
 */
export function uploadToStorage(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    // MinIO infers content type from this header for the stored object.
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

    xhr.send(file);
  });
}

/** Step 3: confirm the upload so the backend kicks off processing. */
export function completeUpload(videoId: string): Promise<CompleteUploadResponse> {
  return request<CompleteUploadResponse>(
    `/api/videos/${videoId}/complete-upload`,
    { method: "POST" }
  );
}

/** List all videos, newest first. */
export function listVideos(): Promise<VideoListItem[]> {
  return request<VideoListItem[]>("/api/videos/get-videos");
}

/**
 * Fetch playback info. A 409 means "not ready yet" (still processing or
 * failed) — we treat that as a normal result with `ready: false` instead of an
 * error, so the player page can render a processing/failed state.
 */
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

/** Ask AI a question about a video's content. */
export function askQuestion(videoId: string, question: string): Promise<AskResponse> {
  return request<AskResponse>(`/api/videos/${videoId}/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

// --- Auth ---

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

// --- Admin ---

export function getAdminStats(): Promise<AdminStats> {
  return request<AdminStats>("/api/admin/stats");
}

export function getAdminVideos(page = 1, limit = 25): Promise<AdminVideosResponse> {
  return request<AdminVideosResponse>(`/api/admin/videos?page=${page}&limit=${limit}`);
}

export function getAdminUsers(): Promise<AdminUsersResponse> {
  return request<AdminUsersResponse>("/api/admin/users");
}

