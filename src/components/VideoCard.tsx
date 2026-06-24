import Link from "next/link";
import type { VideoListItem } from "@/lib/types";
import StatusBadge from "./StatusBadge";

export default function VideoCard({ video }: { video: VideoListItem }) {
  const playable = video.status === "completed";

  return (
    <Link
      href={`/videos/${video.id}`}
      className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all duration-300 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {/* Thumbnail 16:9 container */}
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-850">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title || "Video thumbnail"}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              className={`h-8 w-8 text-zinc-400 dark:text-zinc-600 ${
                video.status !== "completed" && video.status !== "failed" ? "animate-pulse" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        
        {/* Floating StatusBadge overlay on top-right */}
        <div className="absolute top-3 right-3 z-10">
          <StatusBadge status={video.status} progress={video.progress} />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400 transition-colors">
          {video.title || "Untitled"}
        </h3>
        
        {video.status === "transcoding" && (
          <div className="w-full">
            <div className="flex justify-between text-[10px] font-medium text-amber-600 dark:text-amber-500 mb-1">
              <span>Transcoding</span>
              <span>{video.progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-300"
                style={{ width: `${video.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800/60">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {playable
              ? "Ready to play →"
              : video.status === "failed"
                ? "Processing failed"
                : "Processing…"}
          </span>
          {video.createdAt && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {new Date(video.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
