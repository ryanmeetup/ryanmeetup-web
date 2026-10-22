import { afterEach, describe, expect, it, vi } from "vitest";

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/lib/server/ryd-upload-reminder", () => ({
  runRydUploadReminder: run,
}));
import { GET } from "@/app/api/cron/ryd-upload-reminder/route";

describe("RY-D upload reminder cron", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("rejects a missing server secret and invalid bearer credentials before running", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(
      (await GET(new Request("http://localhost/api/cron/ryd-upload-reminder")))
        .status,
    ).toBe(401);
    vi.stubEnv("CRON_SECRET", "synthetic-secret");
    expect(
      (
        await GET(
          new Request("http://localhost/api/cron/ryd-upload-reminder", {
            headers: { authorization: "Bearer wrong-secret" },
          }),
        )
      ).status,
    ).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });
  it("returns the worker result to an authenticated cron invocation", async () => {
    vi.stubEnv("CRON_SECRET", "synthetic-secret");
    run.mockResolvedValue({
      outcome: "disabled",
      sent: 0,
      failed: 0,
      slotDate: null,
      detail: null,
    });
    const response = await GET(
      new Request("http://localhost/api/cron/ryd-upload-reminder", {
        headers: { authorization: "Bearer synthetic-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      outcome: "disabled",
      sent: 0,
    });
    expect(run).toHaveBeenCalledOnce();
  });
});
