import type { RydQueue } from "./queue-types";

/** A reload may publish only while it is the newest work on this queue. */
export function createRydQueueRefresh(
  read: (signal: AbortSignal) => Promise<RydQueue>,
  publish: (queue: RydQueue) => void,
) {
  let generation = 0;
  let active: AbortController | null = null;
  function invalidate() {
    generation += 1;
    active?.abort();
    active = null;
  }
  async function refresh() {
    invalidate();
    const version = generation;
    const controller = new AbortController();
    active = controller;
    try {
      const loaded = await read(controller.signal);
      if (version === generation) publish(loaded);
    } catch (error) {
      if (version === generation) throw error;
    } finally {
      if (active === controller) active = null;
    }
  }
  return { refresh, invalidate };
}
