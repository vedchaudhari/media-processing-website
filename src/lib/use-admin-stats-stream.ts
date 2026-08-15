"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { streamAdminStats } from "./api";
import { useAuth } from "./auth-context";
import type { StreamStatus } from "./sse";
import type { AdminStats } from "./types";

export const ADMIN_STATS_KEY = ["admin", "stats"] as const;

export function useAdminStatsStream(): StreamStatus {
  const queryClient = useQueryClient();
  const { token, isHydrated } = useAuth();
  const [status, setStatus] = useState<StreamStatus>("connecting");

  useEffect(() => {

    if (!isHydrated || !token) return;

    return streamAdminStats({
      onStats: (stats: AdminStats) => {
        queryClient.setQueryData(ADMIN_STATS_KEY, stats);

        void queryClient.cancelQueries(
          { queryKey: ADMIN_STATS_KEY, exact: true },
          { revert: false }
        );
      },
      onStatus: setStatus,
    });

  }, [isHydrated, token, queryClient]);

  return status;
}
