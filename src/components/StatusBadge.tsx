import type { VideoStatus } from "@/lib/types";

const STYLES: Record<VideoStatus, string> = {
  uploading: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  uploaded: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  inspecting: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  inspected: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  planning: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  planned: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  transcoding: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function StatusBadge({
  status,
  progress,
}: {
  status: VideoStatus;
  progress?: number;
}) {
  const showPct =
    status === "transcoding" && typeof progress === "number" && progress > 0;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STYLES[status]}`}
    >
      {status}
      {showPct ? ` ${progress}%` : ""}
    </span>
  );
}
