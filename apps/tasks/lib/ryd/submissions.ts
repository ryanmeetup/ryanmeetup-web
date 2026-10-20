import { rydSubmissionKey, type RydSubmission } from "./matching";
import {
  normalizeEmail,
  parseDriveFileIds,
  parseSocialLinks,
} from "./normalize";
import { VERIFIED_MARK } from "./orders";

/**
 * Columns are found by what their question says rather than by position, so
 * reordering the form or adding a question doesn't break the read.
 */
const COLUMN_PATTERNS = {
  timestamp: /^timestamp$/i,
  legalName: /legal name/i,
  email: /email/i,
  files: /upload|file/i,
  social: /social/i,
  verified: /^verified\??$/i,
} as const;

export type RydSheetColumns = Record<keyof typeof COLUMN_PATTERNS, number>;

export function rydSheetColumns(headers: string[]): RydSheetColumns | null {
  const columns = Object.fromEntries(
    Object.entries(COLUMN_PATTERNS).map(([key, pattern]) => [
      key,
      headers.findIndex((header) => pattern.test(header.trim())),
    ]),
  ) as RydSheetColumns;
  // Without these three there is nothing to match on. Evidence columns and
  // the tick column may be absent; the tick column is then not written to.
  return columns.timestamp < 0 || columns.legalName < 0 || columns.email < 0
    ? null
    : columns;
}

/** Spreadsheet values (first row headers) to submissions. */
export function parseRydSubmissions(values: string[][]) {
  const [headers = [], ...rows] = values;
  const columns = rydSheetColumns(headers);
  if (!columns) return null;
  const cell = (row: string[], column: number) =>
    column < 0 ? "" : (row[column] ?? "").trim();

  const submissions: RydSubmission[] = [];
  rows.forEach((row, index) => {
    const email = normalizeEmail(cell(row, columns.email));
    const submittedAt = cell(row, columns.timestamp);
    if (!email || !submittedAt) return;
    const socialText = cell(row, columns.social);
    submissions.push({
      key: rydSubmissionKey(email, submittedAt),
      row: index + 2,
      submittedAt,
      legalName: cell(row, columns.legalName).replace(/\s+/g, " "),
      email,
      fileIds: parseDriveFileIds(cell(row, columns.files)),
      socialText,
      socialLinks: parseSocialLinks(socialText),
      verified: cell(row, columns.verified).includes(VERIFIED_MARK),
    });
  });
  return { columns, submissions };
}
