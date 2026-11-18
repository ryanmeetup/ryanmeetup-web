import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchModerationPage, saveModerationDecision } from "@/lib/store-reviews/moderation-client";

describe("review moderation browser transport", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("preserves the exact timestamp cursor and requests an uncached page", async () => {
    const transport = vi.fn().mockResolvedValue(Response.json({ reviews: [], next: null }));
    vi.stubGlobal("fetch", transport);
    await fetchModerationPage("hidden", { id: "internal-review-id", createdAt: "2026-11-18T12:00:00.123456Z" });
    const [url, init] = transport.mock.calls[0];
    const params = new URL(url, "https://tasks.test").searchParams;
    expect(params.get("filter")).toBe("hidden");
    expect(params.get("afterCreatedAt")).toBe("2026-11-18T12:00:00.123456Z");
    expect(init.cache).toBe("no-store");
  });
  it("does not retry a conflict or a decision that lacks positive acknowledgement", async () => {
    const decision = { action: "hide" as const, reviewId: "id", revisionId: null, expectedUpdatedAt: "2026-11-18T12:00:00.123456Z", note: "Private reason" };
    const transport = vi.fn().mockResolvedValue(Response.json({ code: "CONFLICT", error: "Review changed" }, { status: 409 }));
    vi.stubGlobal("fetch", transport);
    await expect(saveModerationDecision(decision)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual(decision);
    transport.mockResolvedValue(Response.json({ saved: false }));
    await expect(saveModerationDecision(decision)).rejects.toThrow("could not be confirmed");
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
