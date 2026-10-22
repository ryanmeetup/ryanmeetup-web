import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { instanceDefaults } from "@/lib/instance";
import { runRydUploadReminder } from "@/lib/server/ryd-upload-reminder";

const mocks = vi.hoisted(() => ({
  instance: vi.fn(),
  admin: vi.fn(),
  settings: vi.fn(),
  digest: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/server/instance-settings", () => ({
  getInstanceSettings: mocks.instance,
}));
vi.mock("@/lib/server/admin-client", () => ({ getAdminClient: mocks.admin }));
vi.mock("@/lib/server/ryd", () => ({ loadRydSettings: mocks.settings }));
vi.mock("@/lib/server/digest-settings", () => ({
  readDigestSettings: mocks.digest,
}));
vi.mock("@/lib/server/ryd-upload-reminder-email", () => ({
  sendRydUploadReminderEmail: mocks.send,
}));

const now = new Date("2026-10-20T16:00:00Z");
const previous = "2026-10-13";
type Write = { value: unknown; filters: unknown[][] };

function fixture({ claimed = true, memberError = false } = {}) {
  const writes: Write[] = [];
  const profileIds: unknown[] = [];
  const rpc = vi.fn().mockResolvedValue({
    data: ["one", { workspace_area_members: "two" }],
    error: memberError ? { message: "Permission metadata unavailable" } : null,
  });
  const getUserById = vi.fn(async (id: string) => ({
    data: { user: { email: `${id}@example.test` } },
    error: null,
  }));
  const from = vi.fn((name: string) => {
    let operation = "select";
    let status = "";
    let write: Write | undefined;
    const query: Record<string, unknown> = {};
    query.select = () => query;
    query.upsert = () => {
      operation = "upsert";
      return query;
    };
    query.update = (value: unknown) => {
      operation = "update";
      write = { value, filters: [] };
      writes.push(write);
      return query;
    };
    query.eq = (key: string, value: unknown) => {
      if (key === "status") status = String(value);
      write?.filters.push([key, value]);
      return query;
    };
    query.is = () => query;
    query.or = () => {
      operation = "claim";
      return query;
    };
    query.in = (_key: string, ids: unknown[]) => {
      profileIds.push(...ids);
      return query;
    };
    const result = () => {
      if (name === "profiles")
        return {
          data: [
            { id: "one", full_name: "One" },
            { id: "two", full_name: "Two" },
          ],
          error: null,
        };
      if (name === "ryd_orders")
        return { count: status === "pending" ? 3 : 1, error: null };
      if (operation === "claim")
        return { data: claimed ? [{ id: true }] : [], error: null };
      return {
        data:
          operation === "select" ? { upload_reminder_sent_on: previous } : null,
        error: null,
      };
    };
    query.maybeSingle = async () => result();
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve);
    return query;
  });
  mocks.admin.mockReturnValue({ from, rpc, auth: { admin: { getUserById } } });
  return { from, rpc, writes, profileIds, getUserById };
}

describe("RY-D upload reminder worker", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("RESEND_API_KEY", "synthetic-key");
    vi.stubEnv("TASK_DIGEST_FROM_EMAIL", "reminders@example.test");
    mocks.instance.mockResolvedValue({ ...instanceDefaults, rydEnabled: true });
    mocks.settings.mockResolvedValue({
      uploadReminder: { enabled: true, weekday: 2, hour: 12 },
    });
    mocks.digest.mockResolvedValue({ timeZone: "America/New_York" });
    mocks.send.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not read RY-D tables or send on a disabled instance", async () => {
    mocks.instance.mockResolvedValue({ rydEnabled: false });
    expect(await runRydUploadReminder({ now })).toMatchObject({
      outcome: "disabled",
      sent: 0,
    });
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("leaves settings and recipients alone outside the workspace-local hour", async () => {
    const db = fixture();
    expect(
      await runRydUploadReminder({ now: new Date("2026-10-20T12:00:00Z") }),
    ).toMatchObject({ outcome: "off_schedule" });
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("does not claim a slot without a configured mail transport", async () => {
    const db = fixture();
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await runRydUploadReminder({ now })).toMatchObject({
      outcome: "unconfigured",
    });
    expect(db.from).not.toHaveBeenCalled();
  });
  it("does not send when another run already claimed the slot", async () => {
    const db = fixture({ claimed: false });
    expect(await runRydUploadReminder({ now })).toMatchObject({
      outcome: "already_sent",
    });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("sends only to the access resolver's members with stable retry keys", async () => {
    const db = fixture();
    expect(await runRydUploadReminder({ now })).toMatchObject({
      outcome: "sent",
      slotDate: "2026-10-20",
      sent: 2,
      failed: 0,
    });
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("workspace_area_members", {
      requested_area: "ryd",
    });
    expect(db.profileIds).toEqual(["one", "two"]);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "one@example.test",
        counts: { pending: 3, needsInfo: 1 },
        idempotencyKey: "ryd-upload-reminder/one/2026-10-20",
      }),
    );
    expect(db.writes).toHaveLength(1);
  });
  it("fails closed and releases only its own claim if member access cannot be read", async () => {
    const db = fixture({ memberError: true });
    expect(await runRydUploadReminder({ now })).toMatchObject({
      outcome: "failed",
      sent: 0,
    });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(db.writes[1]).toEqual({
      value: { upload_reminder_sent_on: previous },
      filters: [
        ["id", true],
        ["upload_reminder_sent_on", "2026-10-20"],
      ],
    });
  });
  it("releases a failed run for retry while keeping each message's idempotency key", async () => {
    const db = fixture();
    mocks.send.mockRejectedValue(new Error("Synthetic mail failure"));
    expect(await runRydUploadReminder({ now })).toMatchObject({
      outcome: "failed",
      sent: 0,
      failed: 2,
    });
    expect(db.writes[1]?.filters).toContainEqual([
      "upload_reminder_sent_on",
      "2026-10-20",
    ]);
  });
  it("keeps the slot claimed after a partial send", async () => {
    const db = fixture();
    mocks.send.mockRejectedValueOnce(new Error("Synthetic mail failure"));
    expect(await runRydUploadReminder({ now })).toMatchObject({
      outcome: "sent",
      sent: 1,
      failed: 1,
    });
    expect(db.writes).toHaveLength(1);
  });
});
