"use client";

import { useRef, useState } from "react";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import {
  rydProductionGroups,
  type RydProductionAction,
  type RydProductionResult,
} from "@/lib/ryd/bulk-operations";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";

/** Pin groups and retry IDs once; resume at the first unconfirmed group. */
export function useRydProductionOperation(
  orders: RydQueueOrder[],
  action: RydProductionAction,
  onApplied: (result: RydProductionResult) => void,
) {
  const [groups] = useState(() =>
    rydProductionGroups(orders, action).map((moves) => ({
      operationId: crypto.randomUUID(),
      moves,
    })),
  );
  const cursor = useRef(0);
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [error, setError] = useState("");
  const total = groups.reduce((count, group) => count + group.moves.length, 0);
  async function run() {
    if (running.current || cursor.current >= groups.length) return;
    running.current = true;
    setPending(true);
    setError("");
    try {
      while (cursor.current < groups.length) {
        const group = groups[cursor.current];
        const result = await mutate<RydProductionResult>(
          "/api/ryd/production",
          {
            method: "POST",
            body: JSON.stringify(group),
          },
        );
        cursor.current += 1;
        setCompleted((value) => value + group.moves.length);
        onApplied(result);
      }
    } catch (failure) {
      setError(
        errorMessage(
          failure,
          "This group could not be confirmed. Retry to resume safely.",
        ),
      );
    } finally {
      running.current = false;
      setPending(false);
    }
  }
  return { run, pending, completed, total, groupCount: groups.length, error };
}
