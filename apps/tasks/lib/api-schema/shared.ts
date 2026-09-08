export type JsonObject = Record<string, unknown>;

export const isJsonObject = (value: unknown): value is JsonObject =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const objectWithKeys = (
  value: unknown,
  keys: readonly string[],
): JsonObject | null => {
  if (!isJsonObject(value)) return null;
  const object = value;
  return Object.keys(object).every((key) => keys.includes(key)) ? object : null;
};

export const requiredTrimmedText = (value: unknown, max: number) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
};

export const optionalTrimmedText = (value: unknown, max: number) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length <= max ? normalized : null;
};

/** A required string whose empty, trimmed value is represented as `null`. */
export const nullableTrimmedText = (value: unknown, max: number) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length <= max ? normalized || null : undefined;
};

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A calendar day, wrapped so that "no date" and "not a date" stay apart:
 * `{ date }` for a usable value, `null` for one the caller must reject.
 * Missing, `null`, and empty all read as no date, because a cleared date
 * field sends whichever of those the form happens to hold.
 *
 * The round trip through `Date` is what rejects a well-shaped day that does
 * not exist, such as `2026-02-31`.
 */
export const calendarDate = (
  value: unknown,
): { date: string | null } | null => {
  if (value === undefined || value === null || value === "")
    return { date: null };
  if (typeof value !== "string" || !CALENDAR_DATE_PATTERN.test(value))
    return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? null
    : { date: value };
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

export const parseUuid = (value: unknown) => (isUuid(value) ? value : null);

export const uuidList = (value: unknown) => {
  if (!Array.isArray(value) || value.length > 100) return null;
  const ids = value.map(parseUuid);
  return ids.every(Boolean) ? [...new Set(ids as string[])] : null;
};
