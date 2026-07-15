import type {
  CompleteUploadResponse,
  InitiateUploadResponse,
  PlayResult,
  VideoListItem,
  AskResponse,
} from "./types";


const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

/** Small wrapper around fetch that throws a useful error on non-2xx. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message ? `: ${body.message}` : "";
    } catch {
      /* response had no JSON body */
    }
    throw new Error(`Request to ${path} failed (${res.status})${detail}`);
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
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/play`);
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

  throw new Error(body?.message ?? `Failed to load video (${res.status})`);
}

/** Ask AI a question about a video's content. */
export function askQuestion(videoId: string, question: string): Promise<AskResponse> {
  return request<AskResponse>(`/api/videos/${videoId}/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

