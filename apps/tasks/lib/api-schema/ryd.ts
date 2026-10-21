import { RYD_ORDER_STATUSES, type RydOrderStatus } from "@/lib/ryd/orders";
import {
  RYD_PRODUCTION_STAGES,
  type RydProductionStage,
} from "@/lib/ryd/queue-view";
import { formIdFrom } from "@/lib/ryd/form-responses";
import { isRydContactEmail, normalizeEmail } from "@/lib/ryd/normalize";
import { RYD_REMINDER_GROUP_LIMIT, type RydReminderTarget } from "@/lib/ryd/reminders";
import { isJsonObject, isUuid } from "./shared";

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
): { submissionKey: string; source: "manual" | "suggested" } | null {
  if (!isJsonObject(value)) return null;
  const { source, ...rest } = value;
  const link = rydLinkSchema(rest);
  return link && (source === "manual" || source === "suggested")
    ? { ...link, source }
    : null;
}

export function rydSettingsSchema(value: unknown) {
  if (!isJsonObject(value)) return null;
  const keys = Object.keys(value);
  if (
    !keys.length ||
    keys.some((key) => key !== "form" && key !== "fulfillmentEmail")
  )
    return null;
  const parsed: { formId?: string; fulfillmentEmail?: string } = {};
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
    if (!isRydContactEmail(email) || email.length > 254)
      return null;
    parsed.fulfillmentEmail = email;
  }
  return parsed;
}

export const emptyObjectSchema = (value: unknown) =>
  isJsonObject(value) && Object.keys(value).length === 0 ? {} : null;

/** Submitter emails, as the form gave them; they're normalized on the way in. */
export function rydEmailsSchema(value: unknown) {
  if (!isJsonObject(value) || Object.keys(value).length !== 1) return null;
  const emails = value.emails;
  if (!Array.isArray(emails) || !emails.length || emails.length > 500)
    return null;
  if (
    !emails.every(
      (email) =>
        typeof email === "string" &&
        email.trim().length >= 3 &&
        email.length <= 320,
    )
  )
    return null;
  return {
    emails: [...new Set((emails as string[]).map(normalizeEmail))],
  };
}

function orderIds(ids: unknown) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 500) return null;
  if (!ids.every((id) => typeof id === "string" && id && id.length <= 200))
    return null;
  return [...new Set(ids as string[])];
}

/** Up to 500 distinct order IDs, more than the queue ever holds at once. */
export function rydOrderIdsSchema(value: unknown) {
  if (!isJsonObject(value) || Object.keys(value).length !== 1) return null;
  const ids = orderIds(value.orderIds);
  return ids ? { orderIds: ids } : null;
}

/** Verified orders, and the production stage to move them to. */
export function rydProductionSchema(value: unknown) {
  if (!isJsonObject(value) || Object.keys(value).length !== 2) return null;
  const ids = orderIds(value.orderIds);
  if (
    !ids ||
    !RYD_PRODUCTION_STAGES.includes(value.stage as RydProductionStage)
  )
    return null;
  return { orderIds: ids, stage: value.stage as RydProductionStage };
}

/** A server-owned batch identity replaces client-computed ready-order lists. */
export function rydBatchSchema(
  value: unknown,
):
  | { action: "prepare" }
  | { action: "confirm" | "cancel"; snapshotId: string }
  | null {
  if (!isJsonObject(value)) return null;
  if (value.action === "prepare" && Object.keys(value).length === 1)
    return { action: "prepare" };
  if (
    (value.action === "confirm" || value.action === "cancel") &&
    Object.keys(value).length === 2 &&
    isUuid(value.snapshotId)
  )
    return { action: value.action, snapshotId: value.snapshotId };
  return null;
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
