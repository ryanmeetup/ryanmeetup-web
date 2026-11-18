import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), scope: vi.fn(), load: vi.fn(), workspace: vi.fn(), demo: vi.fn() }));
vi.mock("@/lib/server/admin-client", () => ({ getAdminClient: mocks.admin }));
vi.mock("@/lib/server/store-customer-auth/scope", () => ({ getStoreCustomerAuthScope: mocks.scope }));
vi.mock("@/lib/server/store-reviews/moderation", () => ({ loadReviewModerationPage: mocks.load }));
vi.mock("@/lib/server/workspace-page-loader", () => ({ loadWorkspacePage: mocks.workspace, isWorkspaceDemo: mocks.demo }));
vi.mock("@/components/admin/AdminReviewsPageClient", () => ({ AdminReviewsPageClient: () => null }));
import { loadReviewModerationScreen } from "@/lib/server/store-reviews/moderation-screen";
import AdminReviewsPage from "@/app/(workspace)/admin/reviews/page";

describe("review moderation screen boundary", () => {
  beforeEach(() => {
    mocks.admin.mockReturnValue({ marker: "private-client" });
    mocks.scope.mockReturnValue({ shopId: "123" });
    mocks.load.mockResolvedValue({ reviews: [], next: null });
    mocks.demo.mockResolvedValue(false);
    mocks.workspace.mockResolvedValue({ data: {}, user: { id: "owner" } });
  });
  afterEach(() => vi.restoreAllMocks());
  it("requires an owner workspace before loading private moderation data", async () => {
    await AdminReviewsPage();
    expect(mocks.workspace).toHaveBeenCalledWith(["profiles", "statuses", "categories", "projects"], { owner: true });
    expect(mocks.load).toHaveBeenCalledWith({ marker: "private-client" }, "owner", "123", { filter: "pending", after: null });
    mocks.load.mockClear(); mocks.scope.mockClear();
    mocks.workspace.mockRejectedValue(new Error("Owner required"));
    await expect(AdminReviewsPage()).rejects.toThrow("Owner required");
    expect(mocks.scope).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled();
  });
  it("never loads workspace or review data for demo preview", async () => {
    mocks.demo.mockResolvedValue(true);
    await expect(AdminReviewsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.workspace).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled();
  });
  it("keeps disabled instances explicit without constructing an admin client", async () => {
    mocks.scope.mockReturnValue(null);
    expect(await loadReviewModerationScreen("owner")).toEqual({ status: "disabled" });
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled();
  });
  it("reports unavailable storage instead of an empty queue or leaking error details", async () => {
    mocks.admin.mockReturnValue(null);
    expect(await loadReviewModerationScreen("owner")).toEqual({ status: "error" });
    mocks.admin.mockReturnValue({});
    mocks.load.mockRejectedValue(new Error("private buyer text"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await loadReviewModerationScreen("owner")).toEqual({ status: "error" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private buyer text");
  });
});
