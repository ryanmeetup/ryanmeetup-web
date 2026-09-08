import { beforeEach, describe, expect, it, vi } from "vitest";

const authorize = vi.fn();
const loadLinkPreviewImage = vi.fn();

vi.mock("@/lib/server/auth", () => ({ authorize }));
vi.mock("@/lib/server/link-preview", () => ({ loadLinkPreviewImage }));

describe("GET /api/link-preview", () => {
  beforeEach(() => {
    authorize.mockReset();
    loadLinkPreviewImage.mockReset();
  });

  it("requires an onboarded workspace member", async () => {
    authorize.mockResolvedValue({
      response: Response.json({ error: "Sign in" }, { status: 401 }),
    });
    const { GET } = await import("@/app/api/link-preview/route");

    const response = await GET(
      new Request("http://localhost/api/link-preview?url=https://example.com"),
    );

    expect(response.status).toBe(401);
    expect(authorize).toHaveBeenCalledWith({ onboarded: true });
    expect(loadLinkPreviewImage).not.toHaveBeenCalled();
  });

  it("returns optional image metadata without exposing fetch failures", async () => {
    authorize.mockResolvedValue({ user: { id: "member-1" }, supabase: {} });
    loadLinkPreviewImage
      .mockResolvedValueOnce("https://cdn.example.com/card.jpg")
      .mockRejectedValueOnce(new Error("unsafe destination"));
    const { GET } = await import("@/app/api/link-preview/route");

    const preview = await GET(
      new Request(
        "http://localhost/api/link-preview?url=https://example.com/preview",
      ),
    );
    const fallback = await GET(
      new Request(
        "http://localhost/api/link-preview?url=https://example.com/fallback",
      ),
    );

    expect(await preview.json()).toEqual({
      imageUrl: "https://cdn.example.com/card.jpg",
    });
    expect(await fallback.json()).toEqual({ imageUrl: null });
  });

  it("rejects missing and oversized URL parameters", async () => {
    authorize.mockResolvedValue({ user: { id: "member-1" }, supabase: {} });
    const { GET } = await import("@/app/api/link-preview/route");

    const missing = await GET(new Request("http://localhost/api/link-preview"));
    const oversized = await GET(
      new Request(`http://localhost/api/link-preview?url=${"x".repeat(2_049)}`),
    );

    expect(missing.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(loadLinkPreviewImage).not.toHaveBeenCalled();
  });
});
