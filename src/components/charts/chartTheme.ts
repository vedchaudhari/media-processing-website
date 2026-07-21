"use client";

import { useSyncExternalStore } from "react";

/**
 * Chart color tokens, from the design system's reference palette
 * (status colors are mode-invariant; chart chrome swaps per mode). This app
 * has no manual theme toggle — it follows the OS `prefers-color-scheme` via
 * Tailwind's `dark:` classes — so charts (plain SVG, not Tailwind-aware) track
 * the same media query directly instead of a `data-theme` attribute.
 */
export const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

const CHROME = {
  light: {
    surface: "#fcfcfb",
    textPrimary: "#0b0b0b",
    textMuted: "#898781",
    gridline: "#e1e0d9",
    axis: "#c3c2b7",
    sequential: "#2a78d6",
    neutral: "#898781",
  },
  dark: {
    surface: "#1a1a19",
    textPrimary: "#ffffff",
    textMuted: "#898781",
    gridline: "#2c2c2a",
    axis: "#383835",
    sequential: "#3987e5",
    neutral: "#898781",
  },
} as const;

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(MEDIA_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

const getSnapshot = () => window.matchMedia(MEDIA_QUERY).matches;
const getServerSnapshot = () => false;

/**
 * True when the OS is in dark mode. Reads `matchMedia` directly via
 * useSyncExternalStore rather than an effect+setState — this is exactly the
 * "external store" case that hook exists for, so there's no
 * hydrate-then-flip render to coordinate.
 */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Chrome tokens (surface/text/grid/axis) for the current mode. */
export function useChartChrome() {
  const isDark = usePrefersDark();
  return CHROME[isDark ? "dark" : "light"];
}
