import { RYD_ORDER_STATUSES, type RydOrderStatus } from "@/lib/ryd/orders";
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

/** The sheet's ID, from either the ID itself or any link to the sheet. */
export function spreadsheetIdFrom(raw: string) {
  const value = raw.trim();
  const fromUrl = value.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/)?.[1];
  const id = fromUrl ?? value;
  return /^[A-Za-z0-9_-]{20,}$/.test(id) ? id : null;
}

export function rydSettingsSchema(value: unknown) {
  if (!isJsonObject(value)) return null;
  const keys = Object.keys(value);
  if (
    !keys.length ||
    keys.some((key) => key !== "formSheet" && key !== "fulfillmentEmail")
  )
    return null;
  const parsed: { formSheetId?: string; fulfillmentEmail?: string } = {};
  if ("formSheet" in value) {
    if (typeof value.formSheet !== "string") return null;
    const id = spreadsheetIdFrom(value.formSheet);
    if (!id) return null;
    parsed.formSheetId = id;
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
