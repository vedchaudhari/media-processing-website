// Mirrors the backend's video status state machine.
export type VideoStatus =
  | "uploading"
  | "uploaded"
  | "inspecting"
  | "inspected"
  | "planning"
  | "planned"
  | "transcoding"
  | "completed"
  | "failed";

// Item shape returned by GET /api/videos/get-videos.
export interface VideoListItem {
  id: string;
  title?: string;
  status: VideoStatus;
  progress: number;
  thumbnailUrl?: string;
  createdAt?: string;
}

// Response from POST /api/videos/initiate-upload.
export interface InitiateUploadResponse {
  success: boolean;
  videoId: string;
  objectKey: string;
  uploadUrl: string;
}

// Response from POST /api/videos/:id/complete-upload.
export interface CompleteUploadResponse {
  success: boolean;
  videoId: string;
  status: VideoStatus;
}

export interface ITranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface ITranscript {
  status: "pending" | "processing" | "completed" | "failed";
  text?: string;
  segments?: ITranscriptSegment[];
  objectKey?: string;
  error?: string;
}

export interface IChapter {
  start: number;
  title: string;
}

export interface IAISummary {
  // "skipped" = no transcript text to summarize (e.g. a video with no speech).
  status: "pending" | "processing" | "completed" | "failed" | "skipped";
  summary?: string;
  keyTakeaways?: string[];
  technologies?: string[];
  chapters?: IChapter[];
  error?: string;
}

export interface IVectorIndex {
  status: "pending" | "processing" | "completed" | "failed" | "skipped";
  error?: string;
}

// Normalized result of GET /api/videos/:id/play.
// `ready` distinguishes a playable video (200) from a still-processing /
// failed one (409), so the player page never has to inspect HTTP codes.
export interface PlayResult {
  ready: boolean;
  videoId: string;
  title?: string;
  status: VideoStatus;
  progress: number;
  playbackUrl?: string;
  thumbnailUrl?: string;
  transcript?: ITranscript | null;
  aiSummary?: IAISummary | null;
  vectorIndex?: IVectorIndex | null;
}

// Statuses that represent active pipeline work (used for spinners/polling).
export const IN_PROGRESS_STATUSES: VideoStatus[] = [
  "uploading",
  "uploaded",
  "inspecting",
  "inspected",
  "planning",
  "planned",
  "transcoding",
];

export const isInProgress = (status: VideoStatus): boolean =>
  IN_PROGRESS_STATUSES.includes(status);

export interface AskSource {
  text: string;
  start: number;
  end: number;
  score: number;
}

export interface AskResponse {
  success: boolean;
  answer: string;
  sources: AskSource[];
}

