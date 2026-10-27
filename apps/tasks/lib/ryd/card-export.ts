import { serializeCsv } from "./csv";

/** One printed card, as frozen in its batch. */
export type RydCardBatchRow = {
  order_id: string;
  first_name: string;
  last_name: string;
  location: string;
  ryan_since: string;
};

/** A batch as the page lists it. */
export type RydCardBatch = {
  id: string;
  orderCount: number;
  createdAt: string;
  createdBy: string | null;
};

export const RYD_CARD_CSV_HEADERS = [
  "Order Number",
  "Name",
  "Location",
  "Ryan Since",
];

/**
 * Locations and names are free text, and a spreadsheet runs a cell that starts
 * with one of these as a formula. A leading apostrophe keeps it text.
 */
function spreadsheetText(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * Exactly what fulfillment prints. The byte-order mark tells Excel the file is
 * UTF-8, so `Pérez` opens as `Pérez`.
 */
export function rydCardBatchCsv(rows: RydCardBatchRow[]) {
  return `﻿${serializeCsv({
    headers: RYD_CARD_CSV_HEADERS,
    rows: rows.map((row) =>
      [
        row.order_id,
        `${row.first_name} ${row.last_name}`.trim(),
        row.location,
        row.ryan_since,
      ].map(spreadsheetText),
    ),
  })}`;
}

/** `ry-d-cards-2026-10-27.csv`, dated by the batch rather than the download. */
export function rydCardBatchFilename(createdAt: string) {
  const day = createdAt.slice(0, 10);
  return `ry-d-cards-${/^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "batch"}.csv`;
}
