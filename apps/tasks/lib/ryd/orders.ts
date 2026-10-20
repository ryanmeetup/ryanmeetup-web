import { csvColumn, parseCsv, serializeCsv } from "./csv";
import { normalizeEmail } from "./normalize";

export const RYD_ORDER_STATUSES = [
  "pending",
  "verified",
  "needs_info",
  "rejected",
] as const;
export type RydOrderStatus = (typeof RYD_ORDER_STATUSES)[number];

export const RYD_STATUS_LABELS: Record<RydOrderStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  needs_info: "Needs more info",
  rejected: "Rejected",
};

export const VERIFIED_MARK = "✅";

/** The columns an order export must carry for the app to read it. */
const REQUIRED_COLUMNS = [
  "OrderId",
  "BillFirstName",
  "BillLastName",
  "BillEmail",
  "Verified?",
] as const;

export type ParsedRydOrder = {
  orderId: string;
  salesOrder: string;
  storeName: string;
  organization: string;
  orderedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  total: string;
  items: string;
  delivery: string;
  contactMethod: string;
  /** Already ticked by whoever sent the file. */
  verified: boolean;
  /** Every cell, keyed by its header, so the export can rebuild the row. */
  raw: Record<string, string>;
};

export type RydOrderImport =
  | {
      ok: true;
      headers: string[];
      orders: ParsedRydOrder[];
      duplicates: string[];
    }
  | { ok: false; error: string };

export function parseRydOrderCsv(text: string): RydOrderImport {
  const { headers, rows } = parseCsv(text);
  const missing = REQUIRED_COLUMNS.filter(
    (column) => csvColumn(headers, column) < 0,
  );
  if (missing.length)
    return {
      ok: false,
      error: `That file is missing ${missing.join(", ")}. Upload the order summary CSV from fulfillment.`,
    };

  const cell = (row: string[], name: string) => {
    const column = csvColumn(headers, name);
    return column < 0 ? "" : (row[column] ?? "").trim();
  };
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const orders: ParsedRydOrder[] = [];
  for (const row of rows) {
    const orderId = cell(row, "OrderId");
    if (!orderId) continue;
    if (seen.has(orderId)) {
      duplicates.push(orderId);
      continue;
    }
    seen.add(orderId);
    orders.push({
      orderId,
      salesOrder: cell(row, "Sales Order"),
      storeName: cell(row, "Store Name"),
      organization: cell(row, "Organization"),
      orderedAt: cell(row, "OrderDate"),
      firstName: cell(row, "BillFirstName"),
      lastName: cell(row, "BillLastName"),
      email: normalizeEmail(cell(row, "BillEmail")),
      total: cell(row, "OrderTotal"),
      items: cell(row, "OrderItems"),
      delivery: cell(row, "Delivery"),
      contactMethod: cell(row, "Preferred Method of Contact"),
      verified: cell(row, "Verified?").includes(VERIFIED_MARK),
      raw: Object.fromEntries(
        headers.map((header, column) => [header, row[column] ?? ""]),
      ),
    });
  }
  return { ok: true, headers, orders, duplicates };
}

/**
 * The file fulfillment gets back: their own columns in their own order, with
 * `Verified?` reflecting the decision and nothing else changed.
 */
export function rydOrderExportCsv(
  headers: string[],
  orders: { raw: Record<string, string>; status: RydOrderStatus }[],
) {
  const verifiedHeader =
    headers.find((header) => header.trim().toLowerCase() === "verified?") ??
    "Verified?";
  const columns = headers.includes(verifiedHeader)
    ? headers
    : [...headers, verifiedHeader];
  return serializeCsv({
    headers: columns,
    rows: orders.map((order) =>
      columns.map((header) =>
        header === verifiedHeader
          ? order.status === "verified"
            ? VERIFIED_MARK
            : ""
          : (order.raw[header] ?? ""),
      ),
    ),
  });
}
