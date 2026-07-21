"use client";

import { useChartChrome } from "./chartTheme";

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
}

/** Shared hover tooltip: chart-surface box, hairline border, text tokens only. */
export default function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  const chrome = useChartChrome();
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        background: chrome.surface,
        border: `1px solid ${chrome.gridline}`,
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
      }}
    >
      {label && (
        <p style={{ margin: 0, marginBottom: 4, color: chrome.textPrimary, fontWeight: 600 }}>
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, color: chrome.textPrimary }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: entry.color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span style={{ color: chrome.textMuted }}>{entry.name}:</span>
          <span style={{ fontWeight: 600 }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
