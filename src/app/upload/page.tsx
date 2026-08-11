"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cancelUpload, completeUpload, initiateUpload, uploadToStorage } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

type Phase = "idle" | "uploading" | "cancelling" | "finalizing" | "done" | "error";

export default function UploadPage() {
  return (
    <RequireAuth>
      <UploadPageContent />
    </RequireAuth>
  );
}

function UploadPageContent() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const videoIdRef = useRef<string | null>(null);

  // "done" is included: router.push kicks off a client navigation but this
  // component stays mounted until the target route is ready, so keep the form
  // locked through that window to prevent a duplicate submit.
  const busy =
    phase === "uploading" ||
    phase === "cancelling" ||
    phase === "finalizing" ||
    phase === "done";

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    setPhase("idle");
    setProgress(0);
  };

  const reset = () => {
    setFile(null);
    setTitle("");
    setPhase("idle");
    setProgress(0);
    setError(null);
    abortControllerRef.current = null;
    videoIdRef.current = null;
  };

  const handleUpload = async () => {
    if (!file) return;
    setError(null);

    try {
      // Step 1: reserve a record + presigned URL.
      const effectiveTitle = title.trim() || file.name;
      const { videoId, uploadUrl } = await initiateUpload(effectiveTitle);
      videoIdRef.current = videoId;

      // Step 2: upload straight to storage with progress.
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setPhase("uploading");
      setProgress(0);
      await uploadToStorage(uploadUrl, file, setProgress, controller.signal);

      // Step 3: confirm so the pipeline starts.
      setPhase("finalizing");
      await completeUpload(videoId);

      setPhase("done");
      // Hand off to the player/status page for this video.
      router.push(`/videos/${videoId}`);
    } catch (err) {
      // handleCancel already drove the UI back to idle for a deliberate
      // cancel — don't show it as an error.
      if (err instanceof Error && err.name === "AbortError") return;
      setPhase("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancel = async () => {
    if (phase !== "uploading") return;
    const videoId = videoIdRef.current;
    setPhase("cancelling");
    abortControllerRef.current?.abort();
    try {
      if (videoId) await cancelUpload(videoId);
    } catch {
      // Best-effort — the client-side abort already stopped the transfer;
      // the hourly stale-upload sweep is the backstop if this call fails.
    }
    reset();
  };

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Upload media
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose a video to process into streaming HLS.
        </p>

        <label className="mt-6 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Title <span className="font-normal text-zinc-400">(optional)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            placeholder="My video"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label
          htmlFor="file-upload"
          className="group mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 px-6 py-10 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
        >
          <svg
            className="h-10 w-10 text-zinc-400 transition-colors group-hover:text-zinc-500 dark:text-zinc-500 dark:group-hover:text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
            />
          </svg>
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              <span className="text-blue-600 dark:text-blue-400">
                Click to choose a file
              </span>{" "}
              or drag and drop
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Video files</p>
          </div>
          <input
            id="file-upload"
            type="file"
            accept="video/*"
            className="sr-only"
            disabled={busy}
            onChange={handleFileChange}
          />
        </label>

        {file && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {file.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatBytes(file.size)}
                {file.type ? ` · ${file.type}` : ""}
              </p>
            </div>
            {!busy && (
              <button
                type="button"
                onClick={reset}
                className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Remove file"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {(phase === "uploading" || phase === "cancelling" || phase === "finalizing") && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {phase === "uploading" && "Uploading…"}
                {phase === "cancelling" && "Cancelling…"}
                {phase === "finalizing" && "Finalizing…"}
              </span>
              <span className="flex items-center gap-3">
                {phase === "uploading" && `${progress}%`}
                {phase === "uploading" && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="font-medium text-zinc-500 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-200"
                style={{
                  width: phase === "uploading" ? `${progress}%` : "100%",
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || busy}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "done"
            ? "Redirecting…"
            : busy
              ? "Working…"
              : "Upload & process"}
        </button>
      </div>
    </div>
  );
}
