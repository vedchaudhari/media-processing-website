"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { streamAdminStats } from "./api";
import { useAuth } from "./auth-context";
import type { StreamStatus } from "./sse";
import type { AdminStats } from "./types";

/** The React Query key the dashboard reads stats from, shared with the fetch path. */
export const ADMIN_STATS_KEY = ["admin", "stats"] as const;

/**
 * Keeps `["admin", "stats"]` in the React Query cache fed by the server's SSE
 * stream instead of a `refetchInterval`.
 *
 * Writing through the cache rather than into local state is what makes this a
 * drop-in swap: the dashboard still reads its data from `useQuery`, and keeps
 * that query's loading/error handling — only the *source* of updates changed.
 *
 * @returns The connection state, for a live/reconnecting indicator.
 */
export function useAdminStatsStream(): StreamStatus {
  const queryClient = useQueryClient();
  const { token, isHydrated } = useAuth();
  const [status, setStatus] = useState<StreamStatus>("connecting");

  useEffect(() => {
    // Wait for the token to be read out of localStorage — connecting first
    // would just earn a 401, which the client treats as terminal.
    if (!isHydrated || !token) return;

    return streamAdminStats({
      onStats: (stats: AdminStats) => {
        queryClient.setQueryData(ADMIN_STATS_KEY, stats);
        // The dashboard's fallback fetch runs in parallel with the stream
        // opening. If it resolves *after* the first pushed frame it would
        // overwrite it with an older snapshot — and since the server dedupes
        // identical payloads, nothing would correct that until the pipeline
        // next moved. Cancelling drops the in-flight fetch's result;
        // `revert: false` keeps the frame we just wrote.
        void queryClient.cancelQueries(
          { queryKey: ADMIN_STATS_KEY, exact: true },
          { revert: false }
        );
      },
      onStatus: setStatus,
    });
    // Re-subscribing on `token` covers logout/login without a page reload.
  }, [isHydrated, token, queryClient]);

  return status;
}
