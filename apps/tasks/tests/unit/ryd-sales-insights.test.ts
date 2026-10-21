import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RydSubmission } from "@/lib/ryd/matching";
import { ryanPosition } from "@/lib/ryd/normalize";
import {
  emailKind,
  orderDate,
  orderTotal,
  profileRydOrder,
  summarizeRydSales,
  type RydInsightOrder,
} from "@/lib/ryd/sales-insights";

const loadRydSettings = vi.fn();
const loadRydGoogleIntegration = vi.fn();
const readRydSubmissions = vi.fn();
vi.mock("@/lib/server/ryd", () => ({ loadRydSettings }));
vi.mock("@/lib/server/ryd-google", () => ({
  loadRydGoogleIntegration,
  readRydSubmissions,
}));

// Synthetic orders shaped like the fulfillment export. No real customer appears.
function order(overrides: Partial<RydInsightOrder> = {}): RydInsightOrder {
  return {
    order_id: "1001",
    ordered_at: "10/14/2026 3:34 PM",
    first_name: "Ryan ",
    last_name: "Example",
    email: "ryan.example@gmail.com",
    raw: {
      "Store Name": "RY-Ds",
      Organization: "Ryan Meet Up",
      OrderTotal: "36.75",
      OrderItems: "1",
      Delivery: "Shipping",
      BillEmail: "ryan.example@gmail.com",
    },
    status: "verified",
    note: null,
    decided_at: "2026-10-15T00:00:00Z",
    cleared_batch_id: "batch-1",
    created_at: "2026-10-15T00:00:00Z",
    ...overrides,
  };
}

function submission(overrides: Partial<RydSubmission> = {}): RydSubmission {
  return {
    key: "response-1",
    submittedAt: "10/14/2026, 1:00 PM",
    submittedAtIso: "2026-10-14T17:00:00Z",
    legalName: "Ryan Example",
    email: "ryan.example@gmail.com",
    fileIds: ["secret-upload"],
    socialText: "",
    socialLinks: [
      {
        url: "https://www.linkedin.com/in/ryanexample",
        label: "ryanexample",
        platform: "linkedin",
        handle: "ryanexample",
      },
    ],
    otherAnswers: [{ question: "How did you hear about us?", answer: "TikTok" }],
    ...overrides,
  };
}

describe("RY-D order profiles", () => {
  it("reads fulfillment's totals and dates", () => {
    expect(orderTotal("1,036.75")).toBe(1036.75);
    expect(orderTotal("$36.75")).toBe(36.75);
    expect(orderTotal("")).toBeNull();
    expect(orderTotal("n/a")).toBeNull();
    expect(orderDate("10/4/2026 3:34 PM")).toBe("2026-10-04");
    expect(orderDate("2026-09-30")).toBe("2026-09-30");
    expect(orderDate("soon")).toBeNull();
  });

  it("sorts email domains into personal, school, and work", () => {
    expect(emailKind("gmail.com")).toBe("personal");
    expect(emailKind("cs.stanford.edu")).toBe("school");
    expect(emailKind("ox.ac.uk")).toBe("school");
    expect(emailKind("acme.co")).toBe("work_or_other");
    expect(emailKind(null)).toBe("none");
  });

  it("keeps the structured email domain and omits structured addresses and uploads", () => {
    const profile = profileRydOrder(order(), [submission()]);
    expect(profile).toMatchObject({
      buyerFirstName: "Ryan",
      emailDomain: "gmail.com",
      emailKind: "personal",
      total: 36.75,
      sentToFulfillment: true,
      formFirstName: "Ryan",
      ryanPosition: "first",
      likelyGift: false,
    });
    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain("ryan.example@gmail.com");
    expect(serialized).not.toContain("secret-upload");
  });

  it("retains private names, free text, and URLs rather than anonymizing them", () => {
    const profile = profileRydOrder(
      order({ note: "Contact gift.recipient@example.test" }),
      [submission({
        socialLinks: [{
          platform: "web",
          label: "Ryan Example",
          url: "https://example.test/ryan?contact=ryan@example.test",
          handle: null,
        }],
        otherAnswers: [{
          question: "Contact details",
          answer: "alternate@example.test",
        }],
      })],
    );
    expect(profile.buyerLastName).toBe("Example");
    expect(profile.submissions[0].legalName).toBe("Ryan Example");
    expect(profile.note).toBe("Contact gift.recipient@example.test");
    expect(profile.submissions[0].socialLinks[0].url).toContain("ryan@example.test");
    expect(profile.submissions[0].otherAnswers[0].answer).toBe("alternate@example.test");
    expect(JSON.stringify(summarizeRydSales([profile]))).toContain("alternate@example.test");
    expect(JSON.stringify(profile)).not.toContain("secret-upload");
  });

  it("records where Ryan falls in the form's name", () => {
    const middle = profileRydOrder(order({ first_name: "Ryan", last_name: "Fox" }), [
      submission({ legalName: "Steven Ryan Fox" }),
    ]);
    expect(middle).toMatchObject({
      formFirstName: "Steven",
      ryanPosition: "middle",
      likelyGift: false,
    });
    expect(ryanPosition("Fox Ryan")).toBe("last");
    expect(ryanPosition("Rian Fox")).toBe("first");
    expect(ryanPosition("Jamie Perez")).toBe("absent");
    expect(ryanPosition("")).toBeNull();
  });

  it("flags a gift when the form names someone other than the buyer", () => {
    const gift = profileRydOrder(order({ first_name: "Jamie" }), [
      submission({ legalName: "Ryan Pêrez" }),
    ]);
    expect(gift).toMatchObject({ formFirstName: "Ryan", likelyGift: true });
    expect(profileRydOrder(order(), []).likelyGift).toBeNull();
  });
});

describe("RY-D sales summary", () => {
  it("groups orders and revenue, and counts form answers", () => {
    const summary = summarizeRydSales([
      profileRydOrder(order(), [submission()]),
      profileRydOrder(
        order({
          order_id: "1002",
          first_name: "RYAN",
          email: "ryan@acme.co",
          ordered_at: "9/30/2026 9:00 AM",
          raw: { OrderTotal: "1,036.75" },
          cleared_batch_id: null,
          status: "pending",
        }),
        [
          submission({
            key: "response-2",
            otherAnswers: [
              { question: "How did you hear about us?", answer: "tiktok " },
            ],
          }),
        ],
      ),
      profileRydOrder(
        order({ order_id: "1003", first_name: "Rian", email: "rian@uni.edu" }),
        [],
      ),
    ]);
    expect(summary.totals).toEqual({
      orders: 3,
      revenue: 1110.25,
      sentToFulfillment: 2,
      linkedToForm: 2,
      likelyGifts: 0,
      selfPurchases: 2,
    });
    expect(summary.distributions.byBuyerFirstName).toEqual([
      { value: "Ryan", orders: 2, revenue: 1073.5 },
      { value: "Rian", orders: 1, revenue: 36.75 },
    ]);
    // One order each, so the larger order ranks first.
    expect(summary.distributions.byEmailKind.map((g) => g.value)).toEqual([
      "work_or_other",
      "personal",
      "school",
    ]);
    expect(summary.distributions.byMonth.map((g) => g.value)).toEqual([
      "2026-10",
      "2026-09",
    ]);
    expect(summary.distributions.bySocialPlatform).toEqual([
      { value: "linkedin", orders: 2, revenue: 1073.5 },
    ]);
    expect(summary.formAnswers).toEqual([
      {
        question: "How did you hear about us?",
        responses: 2,
        topAnswers: [{ answer: "tiktok", count: 2 }],
      },
    ]);
  });
});

type Result = { data: unknown; error: { code?: string } | null };

function admin(tables: Record<string, Result>) {
  const chain = (result: Result) => {
    const query = {
      select: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: () => Promise.resolve(result),
      then: (resolve: (value: Result) => unknown) => resolve(result),
    };
    return query;
  };
  return { from: (table: string) => chain(tables[table]) } as never;
}

describe("RY-D MCP reads", () => {
  beforeEach(() => {
    loadRydSettings.mockResolvedValue({ formId: "form", fulfillmentEmail: null });
    loadRydGoogleIntegration.mockResolvedValue({ account_email: "a@test.dev" });
    readRydSubmissions.mockResolvedValue({
      submissions: [submission(), submission({ key: "response-unlinked" })],
    });
  });

  const enabled = {
    instance_settings: { data: { ryd_enabled: true }, error: null },
    ryd_orders: { data: [order(), order({ order_id: "1002" })], error: null },
    ryd_order_submissions: {
      data: [{ order_id: "1001", submission_key: "response-1" }],
      error: null,
    },
  };

  it("says RY-D is off rather than reading orders", async () => {
    const { rydSalesInsights } = await import("@/lib/server/mcp/ryd-read");
    const result = await rydSalesInsights(
      admin({
        instance_settings: { data: { ryd_enabled: null }, error: null },
      }),
      {},
    );
    expect(result.data).toMatchObject({ available: false });
  });

  it("joins linked form answers and filters by date and query", async () => {
    const { loadRydProfiles, filterRydProfiles, rydOrderFilters } =
      await import("@/lib/server/mcp/ryd-read");
    const loaded = await loadRydProfiles(admin(enabled));
    if (!loaded.available) throw new Error("expected profiles");
    expect(loaded.unlinkedSubmissions).toBe(1);
    expect(loaded.profiles.map((p) => p.submissions.length)).toEqual([1, 0]);
    expect(
      filterRydProfiles(
        loaded.profiles,
        rydOrderFilters({ query: "TikTok", from: "2026-10-01" }),
      ).map((p) => p.orderId),
    ).toEqual(["1001"]);
    expect(
      filterRydProfiles(loaded.profiles, rydOrderFilters({ to: "2026-10-01" })),
    ).toEqual([]);
  });

  it("still returns orders, with a warning, when Google won't answer", async () => {
    readRydSubmissions.mockRejectedValue(new Error("invalid_grant"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rydSalesInsights } = await import("@/lib/server/mcp/ryd-read");
    const result = await rydSalesInsights(admin(enabled), {});
    expect(result.data).toMatchObject({
      available: true,
      totals: { orders: 2, linkedToForm: 0 },
      unlinkedSubmissions: null,
    });
    expect(result.warnings[0]).toMatch(/couldn't be read/);
  });

  it("reports missing tables instead of failing", async () => {
    const { loadRydProfiles } = await import("@/lib/server/mcp/ryd-read");
    const loaded = await loadRydProfiles(
      admin({
        ...enabled,
        ryd_orders: { data: null, error: { code: "42P01" } },
      }),
    );
    expect(loaded).toMatchObject({ available: false });
  });
});
