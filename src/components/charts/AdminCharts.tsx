"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { useChartChrome, STATUS_COLORS } from "./chartTheme";
import ChartTooltip from "./ChartTooltip";
import type { VideoStatus, QueueCounts } from "@/lib/types";

// Pipeline order, matching the backend's VIDEO_STATUSES — a snapshot count of
// videos currently sitting in each stage, not a cumulative funnel.
const STATUS_ORDER: VideoStatus[] = [
  "uploading",
  "uploaded",
  "inspecting",
  "inspected",
  "planning",
  "planned",
  "transcoding",
  "completed",
  "failed",
];

/**
 * Bar per video status, in pipeline order. Color carries meaning here (not
 * series identity): blue for "still moving through the pipeline," green for
 * the completed terminal state, red for the failed one — so health reads at
 * a glance without a legend, backed by the x-axis label as the identity channel.
 */
export function PipelineStatusChart({ byStatus }: { byStatus: Record<VideoStatus, number> }) {
  const chrome = useChartChrome();
  const data = STATUS_ORDER.map((status) => ({ status, count: byStatus[status] ?? 0 }));

  const colorFor = (status: VideoStatus) => {
    if (status === "completed") return STATUS_COLORS.good;
    if (status === "failed") return STATUS_COLORS.critical;
    return chrome.sequential;
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke={chrome.gridline} strokeDasharray="0" />
          <XAxis
            dataKey="status"
            tick={{ fill: chrome.textMuted, fontSize: 11 }}
            axisLine={{ stroke: chrome.axis }}
            tickLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={40}
          />
          <YAxis
            tick={{ fill: chrome.textMuted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={28}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: chrome.gridline, opacity: 0.4 }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.status} fill={colorFor(d.status)} />
            ))}
            <LabelList dataKey="count" position="top" fill={chrome.textMuted} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: STATUS_COLORS.good }} /> completed{" "}
        <span className="ml-3 inline-block h-2 w-2 rounded-sm" style={{ background: STATUS_COLORS.critical }} /> failed{" "}
        <span className="ml-3 inline-block h-2 w-2 rounded-sm" style={{ background: chrome.sequential }} /> in progress
      </p>
    </div>
  );
}

const QUEUE_SERIES = [
  { key: "waiting", label: "Waiting", color: "neutral" as const },
  { key: "active", label: "Active", color: "good" as const },
  { key: "delayed", label: "Delayed", color: "warning" as const },
  { key: "failed", label: "Failed", color: "critical" as const },
];

/**
 * Grouped bar per queue: waiting/active/delayed/failed as four genuinely
 * distinct series (not a single measure), so — unlike the status charts here —
 * this one gets a real legend. `completed` is omitted: it's an unbounded
 * historical count, not something to watch live (it's already in the stat
 * cards above).
 */
export function QueueDepthsChart({ queues }: { queues: Record<string, QueueCounts> }) {
  const chrome = useChartChrome();
  const data = Object.entries(queues).map(([name, counts]) => ({
    queue: name,
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    failed: counts.failed ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={chrome.gridline} strokeDasharray="0" />
        <XAxis
          dataKey="queue"
          tick={{ fill: chrome.textMuted, fontSize: 11 }}
          axisLine={{ stroke: chrome.axis }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: chrome.textMuted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: chrome.gridline, opacity: 0.4 }} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: chrome.textMuted }}
          iconType="rect"
          iconSize={10}
        />
        {QUEUE_SERIES.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={STATUS_COLORS[s.color as keyof typeof STATUS_COLORS] ?? chrome.neutral}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Bars per failure stage — every bar means the same thing ("failed here"), so
 * one hue (critical) carries all of them; no legend needed for a single measure. */
export function FailuresByStageChart({ byFailedStage }: { byFailedStage: Record<string, number> }) {
  const chrome = useChartChrome();
  const data = Object.entries(byFailedStage).map(([stage, count]) => ({ stage, count }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={chrome.gridline} strokeDasharray="0" />
        <XAxis
          dataKey="stage"
          tick={{ fill: chrome.textMuted, fontSize: 11 }}
          axisLine={{ stroke: chrome.axis }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: chrome.textMuted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: chrome.gridline, opacity: 0.4 }} />
        <Bar dataKey="count" fill={STATUS_COLORS.critical} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
          <LabelList dataKey="count" position="top" fill={chrome.textMuted} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
