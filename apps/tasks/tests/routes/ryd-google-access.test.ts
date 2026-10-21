import { beforeEach, describe, expect, it, vi } from "vitest";

const authorize = vi.fn();
const getInstanceSettings = vi.fn();
const getAdminClient = vi.fn();
const createRydGoogleOAuthRequest = vi.fn();
const exchangeRydGoogleCode = vi.fn();
const loadRydGoogleIntegration = vi.fn();
const revokeRydGoogle = vi.fn();

vi.mock("@/lib/server/auth", () => ({ authorize }));
vi.mock("@/lib/server/instance-settings", () => ({ getInstanceSettings }));
vi.mock("@/lib/server/admin-client", () => ({ getAdminClient }));
vi.mock("@/lib/server/google-oauth", () => ({
  googleAccountEmail: vi.fn().mockResolvedValue("form@example.com"),
  parseGoogleOAuthCookie: vi
    .fn()
    .mockReturnValue({ state: "state", verifier: "verifier" }),
  requestCookie: vi.fn().mockReturnValue("cookie"),
}));
vi.mock("@/lib/server/ryd-google", () => ({
  createRydGoogleOAuthRequest,
  exchangeRydGoogleCode,
  isRydGoogleConfigured: () => true,
  hasRydGoogleScopes: () => true,
  loadRydGoogleIntegration,
  revokeRydGoogle,
  rydGoogleIntegrationValues: vi.fn().mockReturnValue({ id: "ryd_google" }),
  RYD_GOOGLE_COOKIE: "tasks_ryd_google_oauth",
  RYD_GOOGLE_INTEGRATION_ID: "ryd_google",
}));

const member = { user: { id: "ryd-member" }, supabase: {} };

async function requestGoogle(action: "connect" | "callback" | "disconnect") {
  if (action === "connect") {
    const { GET } =
      await import("@/app/api/integrations/ryd-google/connect/route");
    return GET(
      new Request("http://localhost/api/integrations/ryd-google/connect"),
    );
  }
  if (action === "callback") {
    const { GET } =
      await import("@/app/api/integrations/ryd-google/callback/route");
    return GET(
      new Request(
        "http://localhost/api/integrations/ryd-google/callback?code=code&state=state",
      ),
    );
  }
  const { POST } =
    await import("@/app/api/integrations/ryd-google/disconnect/route");
  return POST(
    new Request("http://localhost/api/integrations/ryd-google/disconnect", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: "{}",
    }),
  );
}

describe("RY-D Google access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authorize.mockResolvedValue(member);
    getInstanceSettings.mockResolvedValue({ rydEnabled: true });
    const result = { error: null };
    getAdminClient.mockReturnValue({
      from: () => ({
        upsert: vi.fn().mockResolvedValue(result),
        delete: () => ({ eq: vi.fn().mockResolvedValue(result) }),
      }),
    });
    createRydGoogleOAuthRequest.mockReturnValue({
      url: "https://accounts.google.com/oauth",
      cookieValue: "cookie",
    });
    exchangeRydGoogleCode.mockResolvedValue({
      refresh_token: "refresh",
      access_token: "access",
      scope: "scopes",
    });
    loadRydGoogleIntegration.mockResolvedValue({ id: "ryd_google" });
    revokeRydGoogle.mockResolvedValue(undefined);
  });

  it.each(["connect", "callback", "disconnect"] as const)(
    "allows a RY-D member to %s without app ownership",
    async (action) => {
      const response = await requestGoogle(action);

      expect(response.status).toBe(action === "disconnect" ? 200 : 307);
      expect(authorize).toHaveBeenCalledExactlyOnceWith({
        onboarded: true,
        area: "ryd",
      });
      if (action === "callback")
        expect(response.headers.get("location")).toBe(
          "http://localhost/ryd?google=connected",
        );
    },
  );

  it.each(["connect", "callback", "disconnect"] as const)(
    "blocks %s before privileged work when page access is denied",
    async (action) => {
      authorize.mockResolvedValue({
        response: new Response(null, { status: 403 }),
      });

      const response = await requestGoogle(action);

      if (action === "callback")
        expect(response.headers.get("location")).toBe(
          "http://localhost/ryd?google=auth",
        );
      else expect(response.status).toBe(403);
      expect(getAdminClient).not.toHaveBeenCalled();
      expect(createRydGoogleOAuthRequest).not.toHaveBeenCalled();
      expect(exchangeRydGoogleCode).not.toHaveBeenCalled();
      expect(loadRydGoogleIntegration).not.toHaveBeenCalled();
      expect(revokeRydGoogle).not.toHaveBeenCalled();
    },
  );

  it.each(["connect", "callback", "disconnect"] as const)(
    "keeps %s unavailable when the instance feature is off",
    async (action) => {
      getInstanceSettings.mockResolvedValue({ rydEnabled: false });
      const response = await requestGoogle(action);

      if (action === "callback")
        expect(response.headers.get("location")).toBe(
          "http://localhost/ryd?google=auth",
        );
      else expect(response.status).toBe(404);
      expect(authorize).not.toHaveBeenCalled();
      expect(getAdminClient).not.toHaveBeenCalled();
    },
  );
});
