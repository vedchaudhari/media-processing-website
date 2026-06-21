"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listVideos } from "@/lib/api";
import { isInProgress } from "@/lib/types";
import VideoCard from "@/components/VideoCard";

export default function LibraryPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["videos"],
    queryFn: listVideos,
    // Poll while anything is still processing, so status badges advance live.
    // Once everything is settled (completed/failed), stop hammering the API.
    refetchInterval: (query) => {
      const videos = query.state.data;
      if (videos && videos.some((v) => isInProgress(v.status))) return 3000;
      return false;
    },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Your uploaded videos and their processing status.
          </p>
        </div>
        <Link
          href="/upload"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          Upload
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Failed to load videos: {error instanceof Error ? error.message : ""}
          <p className="mt-1 text-red-500/80">
            Is the backend running at{" "}
            <code>{process.env.NEXT_PUBLIC_API_BASE_URL}</code>?
          </p>
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No videos yet.
          </p>
          <Link
            href="/upload"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Upload your first video →
          </Link>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
