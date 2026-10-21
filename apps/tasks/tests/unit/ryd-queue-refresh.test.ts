import { describe, expect, it, vi } from "vitest";
import { createRydQueueRefresh } from "@/lib/ryd/queue-refresh";
import type { RydQueue } from "@/lib/ryd/queue-types";

const queue = (clearedCount: number) => ({ clearedCount }) as RydQueue;
function deferred() {
  let resolve!: (value: RydQueue) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<RydQueue>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("RY-D queue refresh ordering", () => {
  it("ignores an old response even if its reader ignores cancellation", async () => {
    const first = deferred();
    const second = deferred();
    const read = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const publish = vi.fn();
    const controller = createRydQueueRefresh(read, publish);
    const a = controller.refresh();
    const b = controller.refresh();
    expect(read.mock.calls[0][0].aborted).toBe(true);
    second.resolve(queue(2));
    await b;
    first.resolve(queue(1));
    await a;
    expect(publish).toHaveBeenCalledExactlyOnceWith(queue(2));
  });
  it("does not let a pending reload overwrite a canonical write", async () => {
    const pending = deferred();
    const publish = vi.fn();
    const controller = createRydQueueRefresh(() => pending.promise, publish);
    const refresh = controller.refresh();
    controller.invalidate();
    pending.resolve(queue(1));
    await refresh;
    expect(publish).not.toHaveBeenCalled();
  });
  it("ignores obsolete failures and propagates the newest reload failure", async () => {
    const first = deferred();
    const second = deferred();
    const read = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const controller = createRydQueueRefresh(read, vi.fn());
    const a = controller.refresh();
    const b = controller.refresh();
    first.reject(new Error("obsolete"));
    await expect(a).resolves.toBeUndefined();
    second.reject(new Error("current"));
    await expect(b).rejects.toThrow("current");
  });
});
