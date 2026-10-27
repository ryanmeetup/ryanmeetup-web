import { csvColumn, CsvParseError, parseCsv, serializeCsv } from "./csv";
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
  /** Every cell, keyed by its header, so the export can rebuild the row. */
  raw: Record<string, string>;
};

/** Counts from a committed import, also returned for a retry. */
export type RydImportSummary = {
  rowCount: number;
  newCount: number;
  existingCount: number;
  duplicateCount: number;
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
  let table;
  try {
    table = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvParseError)
      return { ok: false, error: error.message };
    throw error;
  }
  const { headers, rows } = table;
  const normalizedHeaders = headers.map((header) =>
    header.trim().toLowerCase(),
  );
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length)
    return {
      ok: false,
      error:
        "That file has repeated column names. Give each column a unique name, then upload it again.",
    };
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
  for (const [rowIndex, row] of rows.entries()) {
    const orderId = cell(row, "OrderId");
    if (!orderId)
      return {
        ok: false,
        error: `Order row ${rowIndex + 1} has no OrderId. Fill it in or remove that row before uploading.`,
      };
    if (orderId.length > 64)
      return {
        ok: false,
        error:
          "An order number is longer than 64 characters. Check the OrderId column, then upload it again.",
      };
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
  // A later import can rename or omit a column. Preserve older orders' cells
  // rather than silently losing them when exporting in the newest format.
  const names = new Set(columns.map((header) => header.trim().toLowerCase()));
  const allColumns = [...columns];
  for (const order of orders)
    for (const header of Object.keys(order.raw)) {
      const name = header.trim().toLowerCase();
      if (!names.has(name)) {
        names.add(name);
        allColumns.push(header);
      }
    }
  return serializeCsv({
    headers: allColumns,
    rows: orders.map((order) => {
      const cells = new Map(
        Object.entries(order.raw).map(([header, value]) => [
          header.trim().toLowerCase(),
          value,
        ]),
      );
      return allColumns.map((header) =>
        header === verifiedHeader
          ? order.status === "verified"
            ? VERIFIED_MARK
            : ""
          : (cells.get(header.trim().toLowerCase()) ?? ""),
      );
    }),
  });
}
