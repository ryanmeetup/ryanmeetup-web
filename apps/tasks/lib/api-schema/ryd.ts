import { RYD_ORDER_STATUSES, type RydOrderStatus } from "@/lib/ryd/orders";
import { formIdFrom } from "@/lib/ryd/form-responses";
import { isJsonObject } from "./shared";

/** A decision, a note, or both. An empty note clears it. */
export function rydDecisionSchema(value: unknown) {
  if (!isJsonObject(value)) return null;
  const keys = Object.keys(value);
  if (!keys.length || keys.some((key) => key !== "status" && key !== "note"))
    return null;
  const parsed: { status?: RydOrderStatus; note?: string | null } = {};
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      return null;
    parsed.fulfillmentEmail = email;
  }
  return parsed;
}

export const emptyObjectSchema = (value: unknown) =>
  isJsonObject(value) && Object.keys(value).length === 0 ? {} : null;

/** Up to 500 distinct order IDs, more than the queue ever holds at once. */
export function rydOrderIdsSchema(value: unknown) {
  if (!isJsonObject(value) || Object.keys(value).length !== 1) return null;
  const ids = value.orderIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 500) return null;
  if (!ids.every((id) => typeof id === "string" && id && id.length <= 200))
    return null;
  return { orderIds: [...new Set(ids as string[])] };
}
