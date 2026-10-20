/**
 * The columns of the form's linked response sheet that ticking `Verified?`
 * needs, found by header rather than position.
 */
const COLUMN_PATTERNS = {
  timestamp: /^timestamp$/i,
  email: /e-?mail/i,
  verified: /^verified\??$/i,
} as const;

export type RydSheetColumns = Record<keyof typeof COLUMN_PATTERNS, number>;

export function rydSheetColumns(headers: unknown[]): RydSheetColumns {
  return Object.fromEntries(
    Object.entries(COLUMN_PATTERNS).map(([key, pattern]) => [
      key,
      headers.findIndex(
        (header) => typeof header === "string" && pattern.test(header.trim()),
      ),
    ]),
  ) as RydSheetColumns;
}
