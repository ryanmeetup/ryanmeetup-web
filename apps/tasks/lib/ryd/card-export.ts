import { rydCardComplete } from "./card";
import { serializeCsv } from "./csv";
import type { RydQueueOrder } from "./queue-types";

/** One printed card. */
export type RydCardRow = {
  order_id: string;
  first_name: string;
  last_name: string;
  location: string;
  ryan_since: string;
};

/** Fulfillment's own names for the columns their production reads. */
export const RYD_CARD_CSV_HEADERS = [
  "Order ID#",
  "First & Last",
  "Location",
  "Date",
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
export function rydCardCsv(rows: RydCardRow[]) {
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

/** `ry-d-cards-2026-10-27.csv`, dated by the workspace's day. */
export function rydCardFilename(now: Date, timeZone: string) {
  // en-CA formats as YYYY-MM-DD.
  return `ry-d-cards-${now.toLocaleDateString("en-CA", { timeZone })}.csv`;
}

/**
 * A card file for orders picked by hand, from the cards as the page shows
 * them. Only verified orders with every line print; the rest are skipped.
 * Nothing is saved and no stage moves.
 */
export function rydSelectedCardsFile(
  orders: RydQueueOrder[],
  timeZone: string,
  now = new Date(),
) {
  const printable = orders.filter(
    (order) => order.status === "verified" && rydCardComplete(order.card, now),
  );
  return {
    printable,
    skipped: orders.length - printable.length,
    csv: rydCardCsv(
      printable.map((order) => ({
        order_id: order.orderId,
        first_name: order.card.firstName.trim(),
        last_name: order.card.lastName.trim(),
        location: order.card.location.trim(),
        ryan_since: order.card.ryanSince.trim(),
      })),
    ),
    filename: rydCardFilename(now, timeZone),
  };
}
