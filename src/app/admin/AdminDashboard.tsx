"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getAdminStats, getAdminUsers } from "@/lib/api";
import { ADMIN_STATS_KEY, useAdminStatsStream } from "@/lib/use-admin-stats-stream";
import type { StreamStatus } from "@/lib/sse";
import {
  PipelineStatusChart,
  QueueDepthsChart,
  FailuresByStageChart,
} from "@/components/charts/AdminCharts";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

const STREAM_LABELS: Record<StreamStatus, { text: string; dot: string }> = {
  connecting: { text: "Connecting…", dot: "bg-amber-400" },
  open: { text: "Live", dot: "bg-emerald-500" },
  reconnecting: { text: "Reconnecting…", dot: "bg-amber-400" },
  closed: { text: "Disconnected", dot: "bg-red-500" },
};

/**
 * Connection state of the stats stream. Worth showing: with push instead of
 * polling, a dead connection and a quiet pipeline look identical otherwise —
 * both are just numbers that stopped moving.
 */
function StreamIndicator({ status }: { status: StreamStatus }) {
  const { text, dot } = STREAM_LABELS[status];
  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span
        className={`h-2 w-2 rounded-full ${dot} ${status === "open" ? "" : "animate-pulse"}`}
        aria-hidden
      />
      {text}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  // Updates arrive over SSE (below) rather than on a timer. The one-shot fetch
  // stays as the fallback path: it renders the dashboard even where the stream
  // can't be established — e.g. behind a proxy that buffers text/event-stream.
  const statsQuery = useQuery({
    queryKey: ADMIN_STATS_KEY,
    queryFn: getAdminStats,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const streamStatus = useAdminStatsStream();

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: getAdminUsers,
  });

  const stats = statsQuery.data;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          <StreamIndicator status={streamStatus} />
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Pipeline health, users, and recent failures across every account.
        </p>
      </div>

      {statsQuery.isLoading && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      )}

      {statsQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Failed to load stats:{" "}
          {statsQuery.error instanceof Error ? statsQuery.error.message : "Unknown error"}
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Users" value={stats.totalUsers} />
            <StatCard label="Videos" value={stats.totalVideos} />
            <StatCard label="Completed" value={stats.byStatus.completed ?? 0} />
            <StatCard label="Failed" value={stats.byStatus.failed ?? 0} />
          </div>

          <Section title="Pipeline status">
            <PipelineStatusChart byStatus={stats.byStatus} />
            <div className="mt-6 flex flex-wrap gap-3">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <span className="capitalize text-zinc-600 dark:text-zinc-300">{status}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {count}
                  </span>
                </div>
              ))}
            </div>
            {Object.keys(stats.byFailedStage).length > 0 && (
              <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <p className="mb-2 text-xs font-medium text-zinc-400">Failures by stage</p>
                <FailuresByStageChart byFailedStage={stats.byFailedStage} />
                <div className="mt-3 flex flex-wrap gap-3">
                  {Object.entries(stats.byFailedStage).map(([stage, count]) => (
                    <div
                      key={stage}
                      className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950"
                    >
                      <span className="capitalize text-red-700 dark:text-red-300">{stage}</span>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-200">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section title="Queue depths">
            <QueueDepthsChart queues={stats.queues} />
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-zinc-400">
                    <th className="pb-2 pr-4">Queue</th>
                    <th className="pb-2 pr-4">Waiting</th>
                    <th className="pb-2 pr-4">Active</th>
                    <th className="pb-2 pr-4">Delayed</th>
                    <th className="pb-2 pr-4">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.queues).map(([name, counts]) => (
                    <tr key={name} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 pr-4 capitalize text-zinc-700 dark:text-zinc-200">{name}</td>
                      <td className="py-2 pr-4">{counts.waiting ?? 0}</td>
                      <td className="py-2 pr-4">{counts.active ?? 0}</td>
                      <td className="py-2 pr-4">{counts.delayed ?? 0}</td>
                      <td className="py-2 pr-4">
                        <span className={counts.failed ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                          {counts.failed ?? 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Recent failures">
            {stats.recentFailures.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No failures — everything&apos;s healthy.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {stats.recentFailures.map((video) => (
                  <li key={video._id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <Link
                        href={`/videos/${video._id}`}
                        className="truncate font-medium text-zinc-800 hover:underline dark:text-zinc-100"
                      >
                        {video.title || "Untitled video"}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {video.owner?.email ?? "unknown owner"} · stage: {video.failedStage ?? "unknown"}
                        {video.error ? ` · ${video.error}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-400">
                      {video.failedAt ? new Date(video.failedAt).toLocaleString() : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      <Section title="Users">
        {usersQuery.isLoading && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        )}
        {usersQuery.data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-zinc-400">
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2 pr-4">Videos</th>
                  <th className="pb-2 pr-4">Joined</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.users.map((u) => (
                  <tr key={u._id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-200">{u.email}</td>
                    <td className="py-2 pr-4 capitalize">{u.role}</td>
                    <td className="py-2 pr-4">{u.videoCount}</td>
                    <td className="py-2 pr-4 text-zinc-500 dark:text-zinc-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
