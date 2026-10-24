import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rydBatchSchema } from "@/lib/api-schema";
import { parseCsv } from "@/lib/ryd/csv";
import {
  generateRydFulfillment,
  rydFulfillmentCsv,
} from "@/lib/server/ryd-fulfillment";

const google = vi.hoisted(() => ({ integration: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/server/ryd-google", () => ({
  loadRydGoogleIntegration: google.integration,
  readRydSubmissions: google.read,
}));
beforeEach(() => {
  vi.clearAllMocks();
  google.integration.mockResolvedValue({ account_email: "form@example.test" });
  google.read.mockResolvedValue({ submissions: [] });
});

const rows = [
  {
    order_id: "1",
    status: "verified",
    raw: { OrderId: "1" },
    first_name: "Ryan",
    last_name: "One",
  },
];
const data = {
  recipient: "toney@example.test",
  headers: ["OrderId", "Verified?"],
  generated_at: "2026-10-23T12:00:00Z",
  order_rows: rows,
};
const client = (
  value: unknown,
  links: { order_id: string; submission_key: string }[] = [],
) =>
  createClient("http://ryd.test", "synthetic-key", {
    global: {
      fetch: async (input) => {
        const url = String(input);
        return Response.json(
          url.includes("ryd_order_submissions")
            ? links
            : url.includes("ryd_settings")
              ? { form_id: "verified-form" }
              : value,
        );
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

describe("RY-D on-demand fulfillment files", () => {
  it("generates the email and CSV without a saved batch identity", async () => {
    const preview = await generateRydFulfillment(client(data), "actor", ["1"]);
    expect(preview.recipient).toBe("toney@example.test");
    expect(preview.orderCount).toBe(1);
    expect(preview.draft.body).toContain("1 · Order placed by Ryan One");
    expect(preview.draft.body).not.toContain("Batch:");
    expect(preview).not.toHaveProperty("id");
    expect(parseCsv(preview.csv).rows).toEqual([["1", "✅"]]);
  });
  it("uses only linked recipient answers for a gift, keeping billing CSV cells intact", async () => {
    google.read.mockResolvedValue({
      submissions: [
        {
          key: "linked",
          legalName: "Brooke Ericson on behalf of Ryan Ericson",
        },
        { key: "unlinked", legalName: "Ryan Someone Else" },
      ],
    });
    const gift = {
      ...data,
      order_rows: [
        {
          ...rows[0],
          first_name: "Brooke",
          last_name: "Ericson",
          raw: {
            OrderId: "9421890",
            BillFirstName: "Brooke",
            BillLastName: "Ericson",
          },
          order_id: "9421890",
        },
      ],
    };
    const preview = await generateRydFulfillment(
      client(gift, [
        { order_id: "9421890", submission_key: "linked" },
        { order_id: "unselected", submission_key: "unlinked" },
      ]),
      "actor",
      ["9421890"],
    );
    expect(preview.draft.body).toContain(
      "9421890 · Ryan Ericson (ordered by Brooke Ericson)",
    );
    expect(preview.draft.body).not.toContain("9421890 · Brooke Ericson");
    expect(preview.draft.body).not.toContain("Ryan Someone Else");
    expect(google.read).toHaveBeenCalledWith(
      expect.anything(),
      "verified-form",
      { fresh: true },
    );
    const csv = parseCsv(preview.csv);
    expect(csv.rows[0][csv.headers.indexOf("BillFirstName")]).toBe("Brooke");
  });
  it("does not silently substitute the buyer when a linked response is gone", async () => {
    await expect(
      generateRydFulfillment(
        client(data, [{ order_id: "1", submission_key: "missing" }]),
        "actor",
        ["1"],
      ),
    ).rejects.toMatchObject({ code: "RY409" });
  });
  it("does not silently substitute the buyer when Google is unavailable", async () => {
    google.read.mockRejectedValue(new Error("Synthetic Forms failure"));
    await expect(
      generateRydFulfillment(
        client(data, [{ order_id: "1", submission_key: "linked" }]),
        "actor",
        ["1"],
      ),
    ).rejects.toThrow("Synthetic Forms failure");
  });
  it("requires a name on the linked form before generating recipient instructions", async () => {
    google.read.mockResolvedValue({
      submissions: [{ key: "linked", legalName: "" }],
    });
    await expect(
      generateRydFulfillment(
        client(data, [{ order_id: "1", submission_key: "linked" }]),
        "actor",
        ["1"],
      ),
    ).rejects.toMatchObject({ code: "RY409" });
  });
  it("does not read Google for orders without linked responses", async () => {
    await generateRydFulfillment(client(data), "actor", ["1"]);
    expect(google.read).not.toHaveBeenCalled();
    expect(google.integration).not.toHaveBeenCalled();
  });

  it("accepts only an explicit selection, with no resume, replacement or send confirmation", () => {
    expect(rydBatchSchema({ orderIds: ["1", "1", "2"] })).toEqual({
      orderIds: ["1", "2"],
    });
    for (const value of [
      {},
      { orderIds: [] },
      { action: "prepare", orderIds: ["1"] },
      { action: "confirm", snapshotId: "00000000-0000-4000-8000-000000000301" },
      { orderIds: ["1"], replaceSnapshotId: "old" },
      { orderIds: [null] },
      { orderIds: Array(5001).fill("1") },
    ])
      expect(rydBatchSchema(value)).toBeNull();
  });
  it("preserves access to historical sent CSVs", async () => {
    const csv = await rydFulfillmentCsv(
      client({ ...data, state: "sent" }),
      "00000000-0000-4000-8000-000000000301",
    );
    expect(parseCsv(csv).rows).toEqual([["1", "✅"]]);
  });
  it("refuses cancelled historical files", async () => {
    await expect(
      rydFulfillmentCsv(
        client({ state: "cancelled" }),
        "00000000-0000-4000-8000-000000000301",
      ),
    ).rejects.toMatchObject({ code: "RY409" });
  });
});
