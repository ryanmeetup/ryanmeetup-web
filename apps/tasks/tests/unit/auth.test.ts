import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { authorize } = await import("@/lib/server/auth");

function queryResult(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) builder[method] = () => builder;
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  return builder;
}

describe("authorize", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
    createClient.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when authentication is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    const result = await authorize();

    expect("response" in result && result.response.status).toBe(503);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects an anonymous or failed session", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "expired" },
        }),
      },
    });

    const result = await authorize();

    expect("response" in result && result.response.status).toBe(401);
  });

  it("requires a successfully loaded onboarding record", async () => {
    const from = vi.fn(() =>
      queryResult({ data: null, error: { message: "query failed" } }),
    );
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from,
    });

    const result = await authorize({ onboarded: true });

    expect("response" in result && result.response.status).toBe(403);
    expect(from).toHaveBeenCalledWith("profiles");
  });

  it("requires the canonical owner function to succeed", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: false, error: { message: "denied" } });
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc,
    });

    const result = await authorize({ owner: true });

    expect("response" in result && result.response.status).toBe(403);
    expect(rpc).toHaveBeenCalledWith("is_app_owner");
  });

  it("refuses a page the member cannot open", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc,
    });

    const result = await authorize({ area: "contacts" });

    expect("response" in result && result.response.status).toBe(403);
    expect(rpc).toHaveBeenCalledWith("can_view_workspace_area", {
      requested_area: "contacts",
    });
  });

  it("denies a page when its access check itself fails", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "57014" } }),
    });

    const result = await authorize({ area: "notes" });

    expect("response" in result && result.response.status).toBe(403);
  });

  it("lets a page through on a build whose migration has not run", async () => {
    const user = { id: "user-1" };
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: "PGRST202" } }),
    };
    createClient.mockResolvedValue(supabase);

    await expect(authorize({ area: "notes" })).resolves.toEqual({
      user,
      supabase,
    });
  });

  it("denies service-role-only RY-D data when the access function is missing", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: "PGRST202" } }),
    });
    const result = await authorize({ area: "ryd" });
    expect("response" in result && result.response.status).toBe(403);
  });

  it("returns the authenticated context after every requested gate passes", async () => {
    const user = { id: "owner-1" };
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn(() =>
        queryResult({ data: { onboarding_completed: true }, error: null }),
      ),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    };
    createClient.mockResolvedValue(supabase);

    await expect(authorize({ owner: true, onboarded: true })).resolves.toEqual({
      user,
      supabase,
    });
  });
});
