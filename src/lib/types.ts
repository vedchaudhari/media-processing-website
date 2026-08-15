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

export interface VideoListItem {
  id: string;
  title?: string;
  status: VideoStatus;
  progress: number;
  thumbnailUrl?: string;
  createdAt?: string;
}

export interface InitiateUploadResponse {
  success: boolean;
  videoId: string;
  objectKey: string;
  uploadUrl: string;
}

export interface CompleteUploadResponse {
  success: boolean;
  videoId: string;
  status: VideoStatus;
}

export interface CancelUploadResponse {
  success: boolean;
  cancelled: boolean;
  videoId: string;
  status?: VideoStatus;
}

export type RetryStageName = "transcript" | "ai" | "embedding";

export interface RetryStageResponse {
  success: boolean;
  stage?: RetryStageName;
  status?: string;
  message?: string;
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

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface AdminFailedVideo {
  _id: string;
  title?: string;
  failedStage?: string;
  error?: string;
  failedAt?: string;
  owner?: { _id: string; email: string } | null;
}

export interface QueueCounts {
  waiting?: number;
  active?: number;
  delayed?: number;
  failed?: number;
  completed?: number;
}

export interface AdminStats {

  success?: boolean;
  totalUsers: number;
  totalVideos: number;
  byStatus: Record<VideoStatus, number>;
  byFailedStage: Record<string, number>;
  queues: Record<string, QueueCounts>;
  recentFailures: AdminFailedVideo[];
}

export interface AdminVideoListItem {
  _id: string;
  title?: string;
  status: VideoStatus;
  progress?: number;
  failedStage?: string;
  createdAt?: string;
  owner?: { _id: string; email: string } | null;
}

export interface AdminVideosResponse {
  success: boolean;
  videos: AdminVideoListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminUser {
  _id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  videoCount: number;
}

export interface AdminUsersResponse {
  success: boolean;
  users: AdminUser[];
}

