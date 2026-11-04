import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/ryd/csv";
import {
  rydCardBatchCsv,
  rydCardBatchFilename,
  rydSelectedCardsFile,
} from "@/lib/ryd/card-export";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";

const row = {
  order_id: "607227",
  first_name: "Ryan",
  last_name: "Pérez",
  location: "Brooklyn, NY",
  ryan_since: "1999",
};

describe("RY-D card file", () => {
  it("has the four columns fulfillment asked for, in order", () => {
    const csv = rydCardBatchCsv([row]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(parseCsv(csv)).toEqual({
      headers: ["Order ID#", "First & Last", "Location", "Date"],
      rows: [["607227", "Ryan Pérez", "Brooklyn, NY", "1999"]],
    });
  });

  it("keeps free text from running as a spreadsheet formula", () => {
    const [cells] = parseCsv(
      rydCardBatchCsv([
        { ...row, location: "=HYPERLINK(1)", last_name: "-Le" },
      ]),
    ).rows;
    expect(cells).toEqual(["607227", "Ryan -Le", "'=HYPERLINK(1)", "1999"]);
  });

  it("names the file by the batch date", () => {
    expect(rydCardBatchFilename("2026-10-27T15:00:00.000Z")).toBe(
      "ry-d-cards-2026-10-27.csv",
    );
    expect(rydCardBatchFilename("not a date")).toBe("ry-d-cards-batch.csv");
  });
});

describe("RY-D selected cards", () => {
  const card = {
    firstName: " Ryan",
    lastName: "Pérez ",
    location: "Brooklyn, NY",
    ryanSince: "1999",
  };
  const order = (orderId: string, overrides: Partial<RydQueueOrder> = {}) =>
    ({ orderId, status: "verified", card, ...overrides }) as RydQueueOrder;

  it("prints verified, complete cards in selection order and skips the rest", () => {
    const file = rydSelectedCardsFile(
      [
        order("2"),
        order("1", { sentToFulfillment: true }),
        order("blank", { card: { ...card, ryanSince: "" } }),
        order("pending", { status: "pending" }),
      ],
      "America/New_York",
      new Date("2026-11-05T02:00:00Z"),
    );
    expect(parseCsv(file.csv).rows).toEqual([
      ["2", "Ryan Pérez", "Brooklyn, NY", "1999"],
      ["1", "Ryan Pérez", "Brooklyn, NY", "1999"],
    ]);
    expect(file.skipped).toBe(2);
    // Still the 4th in New York, though UTC has reached the 5th.
    expect(file.filename).toBe("ry-d-cards-2026-11-04.csv");
  });
});
