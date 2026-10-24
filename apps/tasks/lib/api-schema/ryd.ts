import { RYD_ORDER_STATUSES, type RydOrderStatus } from "@/lib/ryd/orders";
import { formIdFrom } from "@/lib/ryd/form-responses";
import { isRydContactEmail, normalizeEmail } from "@/lib/ryd/normalize";
import {
  isRydUploadReminder,
  type RydUploadReminder,
} from "@/lib/ryd/upload-reminder";
import {
  RYD_REMINDER_GROUP_LIMIT,
  type RydReminderTarget,
} from "@/lib/ryd/reminders";
import { isJsonObject, isUuid } from "./shared";
import { RYD_FULFILLMENT_STAGES } from "@/lib/ryd/fulfillment-view";
import { RYD_FULFILLMENT_LIMIT } from "@/lib/ryd/fulfillment";
import {
  RYD_BULK_BODY_BYTES,
  RYD_BULK_LIMIT,
  rydBodyBytes,
  type RydProductionMove,
} from "@/lib/ryd/bulk-operations";

/** A decision, a note, or both. An empty note clears it. */
export function rydDecisionSchema(value: unknown) {
  if (!isJsonObject(value)) return null;
  const keys = Object.keys(value);
  if (
    (!("status" in value) && !("note" in value)) ||
    keys.some(
      (key) =>
        ![
          "status",
          "note",
          "expectedStatus",
          "expectedUpdatedAt",
          "submissionKeys",
        ].includes(key),
    )
  )
    return null;
  const parsed: {
    status?: RydOrderStatus;
    note?: string | null;
    expectedStatus?: RydOrderStatus;
    expectedUpdatedAt?: string;
    submissionKeys?: string[];
  } = {};
  if ("expectedStatus" in value) {
    if (!RYD_ORDER_STATUSES.includes(value.expectedStatus as RydOrderStatus))
      return null;
    parsed.expectedStatus = value.expectedStatus as RydOrderStatus;
  }
  if ("expectedUpdatedAt" in value) {
    if (
      typeof value.expectedUpdatedAt !== "string" ||
      value.expectedUpdatedAt.length > 40 ||
      !Number.isFinite(Date.parse(value.expectedUpdatedAt))
    )
      return null;
    parsed.expectedUpdatedAt = value.expectedUpdatedAt;
  }
  if ("submissionKeys" in value) {
    if (
      value.status !== "verified" ||
      !Array.isArray(value.submissionKeys) ||
      value.submissionKeys.length > 100 ||
      !value.submissionKeys.every(
        (key) =>
          typeof key === "string" && key.length >= 3 && key.length <= 400,
      )
    )
      return null;
    parsed.submissionKeys = [...new Set(value.submissionKeys as string[])];
  }
  if ("status" in value) {
    if (!RYD_ORDER_STATUSES.includes(value.status as RydOrderStatus))
      return null;
    parsed.status = value.status as RydOrderStatus;
  }
  if ("note" in value) {
    if (value.note !== null && typeof value.note !== "string") return null;
    const note = value.note?.trim() ?? "";
    if (note.length > 2000) return null;
    parsed.note = note || null;
  }
  return parsed;
}

export function rydLinkSchema(value: unknown) {
  if (!isJsonObject(value) || Object.keys(value).length !== 1) return null;
  const key = value.submissionKey;
  return typeof key === "string" && key.length >= 3 && key.length <= 400
    ? { submissionKey: key }
    : null;
}

export function rydLinkCreateSchema(
  value: unknown,
): { submissionKeys: string[]; source: "manual" | "suggested" } | null {
  if (!isJsonObject(value)) return null;
  if (
    Object.keys(value).length !== 2 ||
    (value.source !== "manual" && value.source !== "suggested")
  )
    return null;
  const keys =
    "submissionKey" in value ? [value.submissionKey] : value.submissionKeys;
  if (
    !Array.isArray(keys) ||
    !keys.length ||
    keys.length > RYD_BULK_LIMIT ||
    !keys.every(
      (key) => typeof key === "string" && key.length >= 3 && key.length <= 400,
    ) ||
    rydBodyBytes(value) > RYD_BULK_BODY_BYTES
  )
    return null;
  return {
    submissionKeys: [...new Set(keys as string[])],
    source: value.source,
  };
}

export function rydSettingsSchema(value: unknown) {
  if (!isJsonObject(value)) return null;
  const keys = Object.keys(value);
  if (
    !keys.length ||
    keys.some(
      (key) =>
        key !== "form" &&
        key !== "fulfillmentEmail" &&
        key !== "uploadReminder",
    )
  )
    return null;
  const parsed: {
    formId?: string;
    fulfillmentEmail?: string;
    uploadReminder?: RydUploadReminder;
  } = {};
  if ("uploadReminder" in value) {
    if (!isRydUploadReminder(value.uploadReminder)) return null;
    parsed.uploadReminder = value.uploadReminder;
  }
  if ("form" in value) {
    if (typeof value.form !== "string") return null;
    const id = formIdFrom(value.form);
    if (!id) return null;
    parsed.formId = id;
  }
  if ("fulfillmentEmail" in value) {
    const email =
      typeof value.fulfillmentEmail === "string"
        ? value.fulfillmentEmail.trim()
        : "";
    if (!isRydContactEmail(email) || email.length > 254) return null;
    parsed.fulfillmentEmail = email;
  }
  return parsed;
}

export const emptyObjectSchema = (value: unknown) =>
  isJsonObject(value) && Object.keys(value).length === 0 ? {} : null;

/** One pinned contact confirmation, reused verbatim after a lost response. */
export function rydEmailsSchema(value: unknown) {
  if (
    !isJsonObject(value) ||
    Object.keys(value).length !== 2 ||
    !isUuid(value.operationId) ||
    rydBodyBytes(value) > RYD_BULK_BODY_BYTES
  )
    return null;
  const emails = value.emails;
  if (
    !Array.isArray(emails) ||
    !emails.length ||
    emails.length > RYD_BULK_LIMIT
  )
    return null;
  if (
    !emails.every(
      (email) => typeof email === "string" && isRydContactEmail(email),
    )
  )
    return null;
  return {
    operationId: value.operationId,
    emails: [...new Set((emails as string[]).map(normalizeEmail))],
  };
}

function orderIds(ids: unknown) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 500) return null;
  if (
    !ids.every((id) => typeof id === "string" && id.trim() && id.length <= 64)
  )
    return null;
  return [...new Set(ids as string[])];
}

/** Legacy internal order lists; bulk production has its own bounded envelope. */
export function rydOrderIdsSchema(value: unknown) {
  if (!isJsonObject(value) || Object.keys(value).length !== 1) return null;
  const ids = orderIds(value.orderIds);
  return ids ? { orderIds: ids } : null;
}

/** Verified orders, and the production stage to move them to. */
export function rydProductionSchema(value: unknown) {
  if (
    !isJsonObject(value) ||
    Object.keys(value).length !== 2 ||
    !isUuid(value.operationId) ||
    !Array.isArray(value.moves) ||
    !value.moves.length ||
    value.moves.length > RYD_BULK_LIMIT ||
    rydBodyBytes(value) > RYD_BULK_BODY_BYTES
  )
    return null;
  // Continue accepting retired stages from older clients; the database reads
  // them as Ready to send and Sent to fulfillment.
  const stages: readonly string[] = [
    ...RYD_FULFILLMENT_STAGES,
    "not-started",
    "in-production",
  ];
  const moves: RydProductionMove[] = [];
  const seen = new Set<string>();
  for (const move of value.moves) {
    if (
      !isJsonObject(move) ||
      Object.keys(move).length !== 3 ||
      typeof move.orderId !== "string" ||
      !move.orderId.trim() ||
      move.orderId.length > 64 ||
      seen.has(move.orderId) ||
      !stages.includes(move.from as string) ||
      !stages.includes(move.to as string) ||
      move.from === move.to
    )
      return null;
    seen.add(move.orderId);
    moves.push({
      orderId: move.orderId,
      from: move.from as RydProductionMove["from"],
      to: move.to as RydProductionMove["to"],
    });
  }
  return { operationId: value.operationId, moves };
}

/** Generate files for an explicit selection, without creating a saved batch. */
export function rydBatchSchema(value: unknown): { orderIds: string[] } | null {
  if (
    !isJsonObject(value) ||
    Object.keys(value).length !== 1 ||
    !Array.isArray(value.orderIds) ||
    !value.orderIds.length ||
    value.orderIds.length > RYD_FULFILLMENT_LIMIT ||
    !value.orderIds.every(
      (id) => typeof id === "string" && id.trim() && id.length <= 64,
    )
  )
    return null;
  return { orderIds: [...new Set(value.orderIds as string[])] };
}

export function rydReminderSchema(value: unknown) {
  if (
    !isJsonObject(value) ||
    Object.keys(value).length !== 2 ||
    !isUuid(value.operationId) ||
    !Array.isArray(value.targets) ||
    value.targets.length < 1 ||
    value.targets.length > RYD_REMINDER_GROUP_LIMIT
  )
    return null;
  const targets: RydReminderTarget[] = [];
  const seen = new Set<string>();
  for (const target of value.targets) {
    if (
      !isJsonObject(target) ||
      Object.keys(target).length !== 2 ||
      typeof target.orderId !== "string" ||
      !target.orderId.trim() ||
      target.orderId.length > 64 ||
      typeof target.email !== "string" ||
      !isRydContactEmail(target.email) ||
      seen.has(target.orderId)
    )
      return null;
    seen.add(target.orderId);
    targets.push({
      orderId: target.orderId,
      email: normalizeEmail(target.email),
    });
  }
  return { operationId: value.operationId, targets };
}
