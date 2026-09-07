import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/admin-client", () => ({ getAdminClient: () => null }));
vi.mock("@/lib/server/beginner-flow-health", () => ({
  readBeginnerFlowHealth: async () => null,
}));

import { getIntegrationHealth } from "@/lib/server/integration-health";

afterEach(() => {
  vi.unstubAllEnvs();
});

const byKey = async (key: string) =>
  (await getIntegrationHealth()).find((check) => check.key === key)!;

describe("getIntegrationHealth setup guidance", () => {
  it("attaches a guide to every check that is not yet set up", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("TASK_DIGEST_FROM_EMAIL", "");

    const resend = await byKey("resend");
    expect(resend.state).toBe("missing");
    expect(resend.setup?.steps.length).toBeGreaterThan(0);
    expect(resend.setup?.variables.map((variable) => variable.name)).toContain(
      "RESEND_API_KEY",
    );
    expect(resend.setup?.doc).toBe("apps/tasks/docs/TASK_EMAILS.md");
  });

  it("names every fact's variable in the guide it belongs to", async () => {
    vi.stubEnv("GOOGLE_CALENDAR_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CALENDAR_CLIENT_SECRET", "");
    vi.stubEnv("GOOGLE_CALENDAR_TOKEN_KEY", "");

    const google = await byKey("google-calendar");
    const variables = google.setup?.variables.map((one) => one.name) ?? [];
    for (const fact of google.facts) {
      if (fact.source.startsWith("GOOGLE_")) {
        expect(variables).toContain(fact.source);
      }
    }
  });

  it("builds the redirect URI from this deployment's own origin", async () => {
    vi.stubEnv("TASKS_APP_URL", "https://tasks.example.com");
    vi.stubEnv("GOOGLE_CALENDAR_CLIENT_ID", "");

    const google = await byKey("google-calendar");
    expect(
      google.setup?.steps.some((step) =>
        step.command?.includes(
          "https://tasks.example.com/api/integrations/google-calendar/callback",
        ),
      ),
    ).toBe(true);
  });

  it("omits the guide once the integration is configured", async () => {
    vi.stubEnv("TASKS_APP_URL", "https://tasks.example.com");

    const appUrl = await byKey("app-url");
    expect(appUrl.state).toBe("configured");
    expect(appUrl.setup).toBeUndefined();
  });
});
