import "server-only";

type ReadOptions = { signal?: AbortSignal; fresh?: boolean };

/**
 * Bounded, process-local reuse for authorized Google reads. Callers must check
 * access and load the current connection/settings before choosing a key.
 * A cancelled waiter cannot interrupt another request sharing the same read.
 */
export function createRydGoogleReadCache<T>({
  ttlMs,
  maxEntries,
  retain = () => true,
}: {
  ttlMs: number;
  maxEntries: number;
  retain?: (value: T) => boolean;
}) {
  type Entry = {
    controller: AbortController;
    promise: Promise<T>;
    settled: boolean;
    waiters: number;
    expiresAt: number;
    timer?: ReturnType<typeof setTimeout>;
  };
  const entries = new Map<string, Entry>();
  function remove(key: string, entry: Entry) {
    if (entries.get(key) === entry) entries.delete(key);
    clearTimeout(entry.timer);
  }

  return {
    async read(
      key: string,
      load: (signal: AbortSignal) => Promise<T>,
      { signal, fresh = false }: ReadOptions = {},
    ): Promise<T> {
      signal?.throwIfAborted();
      let entry = entries.get(key);
      if (entry?.settled && (fresh || entry.expiresAt <= Date.now())) {
        remove(key, entry);
        entry = undefined;
      }
      if (!entry) {
        // Evict only completed reads: changing settings must not interrupt a
        // different request. At capacity a new read runs without retention.
        if (entries.size >= maxEntries) {
          const oldest = [...entries].find(([, candidate]) => candidate.settled);
          if (oldest) remove(...oldest);
        }
        const created: Entry = {
          controller: new AbortController(),
          promise: Promise.resolve().then(() => load(created.controller.signal)),
          settled: false,
          waiters: 0,
          expiresAt: 0,
        };
        created.promise = created.promise.then(
          (value) => {
            created.settled = true;
            if (
              entries.get(key) === created &&
              !created.controller.signal.aborted &&
              retain(value)
            ) {
              created.expiresAt = Date.now() + ttlMs;
              created.timer = setTimeout(() => remove(key, created), ttlMs);
              created.timer.unref?.();
            } else remove(key, created);
            return value;
          },
          (error: unknown) => {
            created.settled = true;
            remove(key, created);
            throw error;
          },
        );
        if (entries.size < maxEntries) entries.set(key, created);
        entry = created;
      }

      const shared = entry;
      shared.waiters += 1;
      return new Promise<T>((resolve, reject) => {
        let finished = false;
        function finish() {
          if (finished) return false;
          finished = true;
          signal?.removeEventListener("abort", abort);
          shared.waiters -= 1;
          if (!shared.settled && shared.waiters === 0) {
            remove(key, shared);
            shared.controller.abort();
          }
          return true;
        }
        function abort() {
          if (finish()) reject(signal?.reason);
        }
        signal?.addEventListener("abort", abort, { once: true });
        shared.promise.then(
          (value) => {
            if (finish()) resolve(value);
          },
          (error: unknown) => {
            if (finish()) reject(error);
          },
        );
      });
    },
  };
}
