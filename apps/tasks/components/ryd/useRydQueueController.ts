"use client";

import { useCallback, useEffect, useState } from "react";
import { parseMutationResponse } from "@/lib/mutation-client";
import type { RydQueue } from "@/lib/ryd/queue-types";
import { createRydQueueRefresh } from "@/lib/ryd/queue-refresh";

/** Canonical writes invalidate older reloads before reconciling local state. */
export function useRydQueueController(initialQueue: RydQueue) {
  const [queue, setQueue] = useState(initialQueue);
  const [reloads] = useState(() =>
    createRydQueueRefresh(async (signal) => {
      const response = await fetch("/api/ryd", { cache: "no-store", signal });
      return parseMutationResponse<RydQueue>(response);
    }, setQueue),
  );
  useEffect(() => () => reloads.invalidate(), [reloads]);
  const reconcile = useCallback(
    (apply: (current: RydQueue) => RydQueue) => {
      reloads.invalidate();
      setQueue(apply);
    },
    [reloads],
  );
  return { queue, refresh: reloads.refresh, reconcile };
}
