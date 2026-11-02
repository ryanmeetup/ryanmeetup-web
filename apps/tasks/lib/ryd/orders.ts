import {
  csvColumn,
  CsvParseError,
  csvRecordCell,
  parseCsv,
  serializeCsv,
} from "./csv";
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
  // Stored as `rejected`; the order was turned away and refunded.
  rejected: "Cancelled",
};

export const VERIFIED_MARK = "✅";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * An order total as people read it. Fulfillment writes amounts like `36.7500`
 * or `1,036.75`; anything that isn't a plain amount is shown as written.
 */
export function formatRydOrderTotal(total: string) {
  const amount = total.trim().replace(/^\$/, "").replaceAll(",", "");
  if (!/^-?\d+(\.\d+)?$/.test(amount)) return total.trim();
  return USD.format(Number(amount));
}

/**
 * Chipply sends two exports. The order summary has one row per order
 * (`OrderId`, `BillEmail`, …); the full data export has one row per item
 * (`Order Number`, `Email`, …) and carries the card in `Options Detail`. Each
 * field is read from whichever name the file uses, first match wins.
 */
const RYD_ORDER_COLUMNS = {
  orderId: ["OrderId", "Order Number"],
  salesOrder: ["Sales Order"],
  storeName: ["Store Name", "Name"],
  organization: ["Organization", "Organization Name"],
  orderedAt: ["OrderDate", "Order Date"],
  firstName: ["BillFirstName", "Bill First Name"],
  lastName: ["BillLastName", "Bill Last Name"],
  email: ["BillEmail", "Email"],
  total: ["OrderTotal", "Order Total"],
  items: ["OrderItems", "Item Qty"],
  delivery: ["Delivery", "Distribution"],
} as const;

export type RydOrderColumn = keyof typeof RYD_ORDER_COLUMNS;

/** The fields an order export must carry for the app to read it. */
const REQUIRED_COLUMNS = [
  "orderId",
  "firstName",
  "lastName",
  "email",
] as const satisfies readonly RydOrderColumn[];

/** A field from a stored order row, whichever export it came from. */
export function rydOrderCell(
  raw: Record<string, string>,
  field: RydOrderColumn,
) {
  for (const name of RYD_ORDER_COLUMNS[field]) {
    const value = csvRecordCell(raw, name);
    if (value) return value;
  }
  return "";
}

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
  /**
   * Orders with more than one RY-D in the file. The queue holds one card per
   * order, so only the first imported; the rest need a person.
   */
  multiCardOrderIds?: string[];
  /**
   * Orders already in the queue, first imported without Options Detail, that
   * took it from this file. Absent before the migration that adds it.
   */
  cardDetailsCount?: number;
};

/** What an upload did, in one toast. */
export function rydImportSummaryText(result: RydImportSummary) {
  const parts = [
    `${result.newCount} new order${result.newCount === 1 ? "" : "s"} added`,
  ];
  if (result.existingCount)
    parts.push(`${result.existingCount} already in the queue`);
  if (result.cardDetailsCount)
    parts.push(`${result.cardDetailsCount} of those picked up card details`);
  if (result.duplicateCount)
    parts.push(`${result.duplicateCount} repeated in the file`);
  const multiCard = result.multiCardOrderIds ?? [];
  const extra = multiCard.length
    ? ` ${multiCard.length === 1 ? "Order" : "Orders"} ${multiCard.join(", ")} ${multiCard.length === 1 ? "has" : "have"} more than one RY-D; only the first card was imported, so print the rest from fulfillment's file.`
    : "";
  return `${parts.join(", ")}.${extra}`;
}

export type RydOrderImport =
  | {
      ok: true;
      headers: string[];
      orders: ParsedRydOrder[];
      duplicates: string[];
      multiCardOrderIds: string[];
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
  const columns = Object.fromEntries(
    Object.entries(RYD_ORDER_COLUMNS).map(([field, names]) => [
      field,
      names
        .map((name) => csvColumn(headers, name))
        .find((index) => index >= 0) ?? -1,
    ]),
  ) as Record<RydOrderColumn, number>;
  const missing = REQUIRED_COLUMNS.filter((field) => columns[field] < 0);
  if (missing.length)
    return {
      ok: false,
      error: `That file is missing ${missing
        .map((field) => RYD_ORDER_COLUMNS[field].join(" or "))
        .join(
          ", ",
        )}. Upload fulfillment's full data export or order summary CSV.`,
    };

  const cell = (row: string[], field: RydOrderColumn) =>
    columns[field] < 0 ? "" : (row[columns[field]] ?? "").trim();
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const multiCard = new Set<string>();
  const orders: ParsedRydOrder[] = [];
  for (const [rowIndex, row] of rows.entries()) {
    const orderId = cell(row, "orderId");
    if (!orderId)
      return {
        ok: false,
        error: `Order row ${rowIndex + 1} has no order number. Fill it in or remove that row before uploading.`,
      };
    if (orderId.length > 64)
      return {
        ok: false,
        error:
          "An order number is longer than 64 characters. Check the order number column, then upload it again.",
      };
    // The full export repeats an order on every item it holds; the summary
    // counts them in OrderItems. Either way, a second RY-D is a second card.
    const quantity = Number(cell(row, "items"));
    if (columns.items >= 0 && quantity > 1) multiCard.add(orderId);
    if (seen.has(orderId)) {
      duplicates.push(orderId);
      multiCard.add(orderId);
      continue;
    }
    seen.add(orderId);
    orders.push({
      orderId,
      salesOrder: cell(row, "salesOrder"),
      storeName: cell(row, "storeName"),
      organization: cell(row, "organization"),
      orderedAt: cell(row, "orderedAt"),
      firstName: cell(row, "firstName"),
      lastName: cell(row, "lastName"),
      email: normalizeEmail(cell(row, "email")),
      total: cell(row, "total"),
      items: cell(row, "items"),
      delivery: cell(row, "delivery"),
      raw: Object.fromEntries(
        headers.map((header, column) => [header, row[column] ?? ""]),
      ),
    });
  }
  return {
    ok: true,
    headers,
    orders,
    duplicates,
    multiCardOrderIds: [...multiCard],
  };
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
