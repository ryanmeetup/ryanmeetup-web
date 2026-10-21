import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRydGoogleReadCache } from "@/lib/server/ryd-google-read-cache";

describe("RY-D Google read retention bounds", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("purges expired results even when nobody reads the cache again", async () => {
    const cache = createRydGoogleReadCache({ ttlMs: 100, maxEntries: 1 });
    const load = vi.fn().mockResolvedValue("private answers");
    await cache.read("form", load);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(vi.getTimerCount()).toBe(0);
    await cache.read("form", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("evicts old completed entries at capacity", async () => {
    const cache = createRydGoogleReadCache({ ttlMs: 100, maxEntries: 1 });
    const load = vi.fn().mockResolvedValue("answers");
    await cache.read("first", load);
    await cache.read("second", load);
    await cache.read("first", load);
    expect(load).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("does not interrupt active work when retention is at capacity", async () => {
    const cache = createRydGoogleReadCache<string>({ ttlMs: 100, maxEntries: 1 });
    let complete!: (value: string) => void;
    let upstream!: AbortSignal;
    const first = cache.read("active", (signal) => {
      upstream = signal;
      return new Promise((resolve) => { complete = resolve; });
    });
    const secondLoad = vi.fn().mockResolvedValue("second");
    await cache.read("uncached", secondLoad);
    expect(upstream.aborted).toBe(false);
    complete("first");
    expect(await first).toBe("first");
    await cache.read("uncached", secondLoad);
    expect(secondLoad).toHaveBeenCalledTimes(2);
  });

  it("coalesces oversized reads without retaining their results", async () => {
    const cache = createRydGoogleReadCache<string>({
      ttlMs: 100,
      maxEntries: 2,
      retain: (value) => value.length < 3,
    });
    const load = vi.fn().mockResolvedValue("large form");
    await Promise.all([cache.read("large", load), cache.read("large", load)]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await cache.read("large", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not start work for an already cancelled request", async () => {
    const cache = createRydGoogleReadCache({ ttlMs: 100, maxEntries: 1 });
    const load = vi.fn().mockResolvedValue("answers");
    await expect(cache.read("form", load, {
      signal: AbortSignal.abort(),
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(load).not.toHaveBeenCalled();
  });
});
