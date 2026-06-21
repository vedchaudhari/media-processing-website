import Link from "next/link";
import type { VideoListItem } from "@/lib/types";
import StatusBadge from "./StatusBadge";

export default function VideoCard({ video }: { video: VideoListItem }) {
  const playable = video.status === "completed";

  const inner = (
    <div className="flex h-full flex-col justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-colors dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {video.title || "Untitled"}
        </h3>
        <StatusBadge status={video.status} progress={video.progress} />
      </div>

      {video.status === "transcoding" && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${video.progress}%` }}
          />
        </div>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        {playable
          ? "Ready to play →"
          : video.status === "failed"
            ? "Processing failed"
            : "Processing…"}
      </p>
    </div>
  );

  if (playable) {
    return (
      <Link
        href={`/videos/${video.id}`}
        className="block rounded-xl outline-none ring-blue-500 transition-shadow hover:shadow-md focus-visible:ring-2"
      >
        {inner}
      </Link>
    );
  }

  // Non-completed videos still link to their status page (except keep failed
  // clickable too, so users can see the error context there).
  return (
    <Link href={`/videos/${video.id}`} className="block rounded-xl outline-none">
      {inner}
    </Link>
  );
}
