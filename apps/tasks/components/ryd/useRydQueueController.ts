"use client";

import { useCallback, useEffect, useState } from "react";
import { parseMutationResponse } from "@/lib/mutation-client";
import type { RydQueue } from "@/lib/ryd/queue-types";
import {
  createRydQueueRefresh,
  type RydQueueRefreshState,
} from "@/lib/ryd/queue-refresh";

/** Canonical writes invalidate older reloads before reconciling local state. */
export function useRydQueueController(initialQueue: RydQueue) {
  const [queue, setQueue] = useState(initialQueue);
  const [refreshState, setRefreshState] = useState<RydQueueRefreshState>({
    pending: false,
    error: null,
  });
  const [reloads] = useState(() => {
    // Once someone asks for older done orders, later reloads keep them.
    const scope = { olderDone: false };
    return {
      includeOlderDone: (value: boolean) => {
        scope.olderDone = value;
      },
      ...createRydQueueRefresh(
        async (signal) => {
          const response = await fetch(
            scope.olderDone ? "/api/ryd?done=all" : "/api/ryd",
            {
              cache: "no-store",
              signal,
              headers: { "cache-control": "no-cache" },
            },
          );
          return parseMutationResponse<RydQueue>(response);
        },
        setQueue,
        setRefreshState,
      ),
    };
  });
  useEffect(() => () => reloads.invalidate(), [reloads]);
  const reconcile = useCallback(
    (apply: (current: RydQueue) => RydQueue) => {
      reloads.invalidate();
      setQueue(apply);
    },
    [reloads],
  );
  const showOlderDone = useCallback(async () => {
    reloads.includeOlderDone(true);
    try {
      await reloads.refresh();
    } catch (error) {
      reloads.includeOlderDone(false);
      throw error;
    }
  }, [reloads]);
  return {
    queue,
    refresh: reloads.refresh,
    refreshState,
    reconcile,
    showOlderDone,
  };
}
