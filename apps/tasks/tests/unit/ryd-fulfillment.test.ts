import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { rydBatchSchema } from "@/lib/api-schema";
import { parseCsv } from "@/lib/ryd/csv";
import {
  generateRydFulfillment,
  rydFulfillmentCsv,
} from "@/lib/server/ryd-fulfillment";

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
const client = (value: unknown) =>
  createClient("http://ryd.test", "synthetic-key", {
    global: { fetch: async () => Response.json(value) },
    auth: { persistSession: false, autoRefreshToken: false },
  });

describe("RY-D on-demand fulfillment files", () => {
  it("generates the email and CSV without a saved batch identity", async () => {
    const preview = await generateRydFulfillment(client(data), "actor", ["1"]);
    expect(preview.recipient).toBe("toney@example.test");
    expect(preview.orderCount).toBe(1);
    expect(preview.draft.body).toContain("1 · Ryan One");
    expect(preview.draft.body).not.toContain("Batch:");
    expect(preview).not.toHaveProperty("id");
    expect(parseCsv(preview.csv).rows).toEqual([["1", "✅"]]);
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
