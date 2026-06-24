"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getPlay } from "@/lib/api";
import { isInProgress } from "@/lib/types";
import HlsPlayer from "@/components/HlsPlayer";
import StatusBadge from "@/components/StatusBadge";

export default function VideoDetail({ id }: { id: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["play", id],
    queryFn: () => getPlay(id),
    // Keep polling while the video is still moving through the pipeline.
    refetchInterval: (query) => {
      const result = query.state.data;
      if (result && !result.ready && isInProgress(result.status)) return 3000;
      return false;
    },
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to library
      </Link>

      {isLoading && (
        <div className="mt-6 aspect-video w-full animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      )}

      {isError && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error instanceof Error ? error.message : "Failed to load video"}
        </div>
      )}

      {data && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight">
              {data.title || "Video"}
            </h1>
            <StatusBadge status={data.status} progress={data.progress} />
          </div>

          {/* Ready → play it */}
          {data.ready && data.playbackUrl && (
            <HlsPlayer src={data.playbackUrl} poster={data.thumbnailUrl} />
          )}

          {/* Failed → clear failure state */}
          {!data.ready && data.status === "failed" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                Processing failed
              </p>
              <p className="mt-1 text-sm text-red-500 dark:text-red-400/80">
                Something went wrong while processing this video.
              </p>
            </div>
          )}

          {/* Still processing → progress / spinner */}
          {!data.ready && isInProgress(data.status) && (
            <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Processing your video…
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 capitalize">
                {data.status}
                {data.status === "transcoding" && data.progress > 0
                  ? ` · ${data.progress}%`
                  : ""}
              </p>

              {data.status === "transcoding" && (
                <div className="mx-auto mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${data.progress}%` }}
                  />
                </div>
              )}

              <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
                This page updates automatically.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
