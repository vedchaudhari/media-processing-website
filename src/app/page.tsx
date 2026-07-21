"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listVideos } from "@/lib/api";
import { isInProgress } from "@/lib/types";
import VideoCard from "@/components/VideoCard";
import RequireAuth from "@/components/RequireAuth";

export default function LibraryPage() {
  return (
    <RequireAuth>
      <LibraryPageContent />
    </RequireAuth>
  );
}

function LibraryPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const filteredVideos = data?.filter((video) => {
    // `?? ""` so untitled videos aren't dropped (optional chaining alone would
    // make matchesSearch undefined and filter them out even with no query).
    const matchesSearch = (video.title ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || video.status === statusFilter;
    return matchesSearch && matchesStatus;
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

      {/* Search and Filters */}
      {data && data.length > 0 && (
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search videos by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Status:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="uploading">Uploading</option>
              <option value="transcoding">Transcoding</option>
              <option value="planning">Planning</option>
              <option value="inspecting">Inspecting</option>
            </select>
          </div>
        </div>
      )}

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
        <>
          {filteredVideos && filteredVideos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No videos match your search or filter criteria.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="mt-3 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVideos?.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
