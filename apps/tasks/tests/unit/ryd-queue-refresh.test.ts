import { describe, expect, it, vi } from "vitest";
import { createRydQueueRefresh } from "@/lib/ryd/queue-refresh";
import type { RydQueue } from "@/lib/ryd/queue-types";

const queue = (clearedCount: number) =>
  ({
    clearedCount,
    sheet: { status: "ok", accountEmail: "synthetic@example.com" },
  }) as RydQueue;
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
  it("keeps saved state when Google returns an incomplete HTTP 200 queue and clears the error on retry", async () => {
    let current = queue(99);
    const partial = {
      ...queue(0),
      sheet: {
        status: "error",
        message: "Google unavailable",
        accountEmail: "synthetic@example.com",
      },
    } as RydQueue;
    const report = vi.fn();
    const read = vi
      .fn()
      .mockResolvedValueOnce(partial)
      .mockResolvedValueOnce(queue(100));
    const controller = createRydQueueRefresh(
      read,
      (loaded) => {
        current = loaded;
      },
      report,
    );
    await expect(controller.refresh()).rejects.toThrow("Google unavailable");
    expect(current.clearedCount).toBe(99);
    expect(report).toHaveBeenLastCalledWith({
      pending: false,
      error: expect.any(Error),
    });
    await controller.refresh();
    expect(current.clearedCount).toBe(100);
    expect(report).toHaveBeenLastCalledWith({ pending: false, error: null });
  });
  it("does not let obsolete completion clear the current pending or error state", async () => {
    const old = deferred();
    const newest = deferred();
    const report = vi.fn();
    const read = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(newest.promise);
    const controller = createRydQueueRefresh(read, vi.fn(), report);
    const a = controller.refresh();
    const b = controller.refresh();
    old.resolve(queue(0));
    await a;
    expect(report).toHaveBeenLastCalledWith({ pending: true, error: null });
    newest.reject(new Error("latest"));
    await expect(b).rejects.toThrow("latest");
    expect(report).toHaveBeenLastCalledWith({
      pending: false,
      error: expect.objectContaining({ message: "latest" }),
    });
    controller.invalidate();
    expect(report).toHaveBeenLastCalledWith({
      pending: false,
      error: expect.objectContaining({ message: "latest" }),
    });
  });
});
