import type { RydQueue } from "./queue-types";

export type RydQueueRefreshState = { pending: boolean; error: unknown | null };

/** A reload may publish only while it is the newest work on this queue. */
export function createRydQueueRefresh(
  read: (signal: AbortSignal) => Promise<RydQueue>,
  publish: (queue: RydQueue) => void,
  report: (state: RydQueueRefreshState) => void = () => {},
) {
  let generation = 0;
  let active: AbortController | null = null;
  let failure: unknown | null = null;
  function invalidate() {
    generation += 1;
    active?.abort();
    active = null;
    report({ pending: false, error: failure });
  }
  async function refresh() {
    invalidate();
    const version = generation;
    const controller = new AbortController();
    active = controller;
    failure = null;
    report({ pending: true, error: null });
    try {
      const loaded = await read(controller.signal);
      if (version === generation) {
        // Google failures arrive as a partial HTTP 200 queue. Keep the last
        // complete queue, including any confirmed writes reconciled into it.
        if (loaded.sheet.status === "error")
          throw new Error(loaded.sheet.message);
        publish(loaded);
      }
    } catch (error) {
      if (version === generation) {
        failure = error;
        throw error;
      }
    } finally {
      if (active === controller) {
        active = null;
        report({ pending: false, error: failure });
      }
    }
  }
  return { refresh, invalidate };
}
