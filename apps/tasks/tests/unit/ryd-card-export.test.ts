import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/ryd/csv";
import { rydCardBatchCsv, rydCardBatchFilename } from "@/lib/ryd/card-export";

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
      headers: ["Order Number", "Name", "Location", "Ryan Since"],
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
