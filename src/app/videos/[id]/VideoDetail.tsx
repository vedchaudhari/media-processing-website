"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getPlay } from "@/lib/api";
import { isInProgress } from "@/lib/types";
import HlsPlayer from "@/components/HlsPlayer";
import StatusBadge from "@/components/StatusBadge";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoDetail({ id }: { id: string }) {
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<any>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["play", id],
    queryFn: () => getPlay(id),
    // Keep polling while the video or transcript is still moving through the pipeline.
    refetchInterval: (query) => {
      const result = query.state.data;
      if (result && !result.ready && isInProgress(result.status)) return 3000;
      
      // Also poll if the video is ready but transcript is still processing/pending
      if (result && result.ready && result.transcript && (result.transcript.status === "pending" || result.transcript.status === "processing")) {
        return 3000;
      }
      return false;
    },
  });

  const handlePlayerReady = (player: any) => {
    playerRef.current = player;
    player.on("timeupdate", () => {
      setCurrentTime(player.currentTime());
    });
  };

  const seekTo = (start: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime(start);
      playerRef.current.play();
    }
  };

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
            <div className="space-y-6">
              <HlsPlayer src={data.playbackUrl} poster={data.thumbnailUrl} onReady={handlePlayerReady} />
              
              {/* Interactive Transcript Component */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="mb-4 text-base font-semibold tracking-tight">Interactive Transcript</h2>
                
                {!data.transcript && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No transcript available.</p>
                )}

                {data.transcript && data.transcript.status === "pending" && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Waiting for transcription to start...</p>
                )}

                {data.transcript && data.transcript.status === "processing" && (
                  <div className="flex items-center gap-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400" />
                    <span>Transcribing audio in the background...</span>
                  </div>
                )}

                {data.transcript && data.transcript.status === "failed" && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-950 dark:bg-red-950/20 dark:text-red-400">
                    <p className="font-semibold">Transcription failed</p>
                    <p className="mt-1 text-xs opacity-90">{data.transcript.error || "Unknown error occurred"}</p>
                  </div>
                )}

                {data.transcript && data.transcript.status === "completed" && (
                  <div className="max-h-80 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                    {data.transcript.segments && data.transcript.segments.length > 0 ? (
                      data.transcript.segments.map((segment, index) => {
                        const isActive = currentTime >= segment.start && currentTime < segment.end;
                        return (
                          <div
                            key={index}
                            onClick={() => seekTo(segment.start)}
                            className={`flex gap-4 p-2.5 rounded-lg cursor-pointer transition-all duration-200 text-sm ${
                              isActive
                                ? "bg-blue-50 text-blue-800 border-l-4 border-blue-600 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-400"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            <span className={`font-mono text-xs select-none shrink-0 pt-0.5 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"}`}>
                              {formatTime(segment.start)}
                            </span>
                            <p className="leading-relaxed">{segment.text}</p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Transcript is empty.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
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
