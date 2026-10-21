import { sheetSerial } from "./form-responses";
import type { RydSubmission } from "./matching";
import { isRydContactEmail, normalizeEmail } from "./normalize";
import { rydSheetColumns, type RydSheetColumns } from "./sheet-columns";

export type RydSheetIssue =
  | "not-required"
  | "already-confirmed"
  | "disconnected"
  | "no-linked-sheet"
  | "tab-missing"
  | "tab-ambiguous"
  | "google-unavailable"
  | "write-unconfirmed";

export type RydSheetResponse = {
  key: string;
  legalName: string;
  email: string;
  submittedAt: string;
  outcome: "updated" | "already-ticked" | "missing" | "ambiguous" | "unchecked";
  reason?:
    | "response-missing"
    | "identity-missing"
    | "row-missing"
    | "multiple-responses"
    | "multiple-rows"
    | "existing-value";
  /** One-based row in the response tab, when uniquely identified. */
  row?: number;
};

export type RydSheetReport = {
  issue?: RydSheetIssue;
  spreadsheetId?: string;
  sheetId?: number;
  sheetTitle?: string;
  responses: RydSheetResponse[];
};

const headerText = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/** A copied response tab is ambiguous too: never choose by position or title. */
export function rydResponseSheetColumns(
  headers: unknown[],
  questionTitles: string[],
): RydSheetColumns | null {
  const columns = rydSheetColumns(headers);
  if (Object.values(columns).some((index) => index < 0)) return null;
  const titles = questionTitles.map(headerText);
  if (!titles.length || titles.some((title) => !title)) return null;
  const counts = new Map<string, number>();
  for (const header of headers) {
    const title = headerText(header);
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  if (titles.some((title) => counts.get(title) !== 1)) return null;
  if (new Set(titles).size !== titles.length) return null;
  return columns;
}

export function rydUncheckedSheet(
  keys: string[],
  submissions: RydSubmission[],
  issue: RydSheetIssue,
  spreadsheetId?: string | null,
): RydSheetReport {
  const byKey = new Map(
    submissions.map((submission) => [submission.key, submission]),
  );
  return {
    issue,
    ...(spreadsheetId ? { spreadsheetId } : {}),
    responses: [...new Set(keys)].map((key) => {
      const submission = byKey.get(key);
      return {
        key,
        legalName: submission?.legalName ?? "",
        email: submission?.email ?? "",
        submittedAt: submission?.submittedAt ?? "",
        outcome: "unchecked",
      };
    }),
  };
}

// Sheets uses floating-point days. Ignore representation error, while keeping
// adjacent seconds distinct and accepting subsecond values within the second.
const second = (serial: number) => Math.floor(serial * 86_400 + 0.00001);

/** Plan only one-to-one matches across the entire form, including unselected responses. */
export function planRydSheetReconciliation(
  rows: unknown[][],
  columns: RydSheetColumns,
  submissions: RydSubmission[],
  keys: string[],
  timeZone: string,
) {
  const identity = (submission: RydSubmission) => {
    const email = normalizeEmail(submission.email);
    if (
      !isRydContactEmail(email) ||
      !submission.submittedAtIso ||
      !Number.isFinite(Date.parse(submission.submittedAtIso))
    )
      return null;
    return JSON.stringify([
      email,
      second(sheetSerial(submission.submittedAtIso, timeZone)),
    ]);
  };
  const identities = new Map<string, number>();
  for (const submission of submissions) {
    const id = identity(submission);
    if (id) identities.set(id, (identities.get(id) ?? 0) + 1);
  }
  const rowIdentities = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const email = row[columns.email];
    const stamp = row[columns.timestamp];
    if (
      typeof email !== "string" ||
      !isRydContactEmail(normalizeEmail(email)) ||
      typeof stamp !== "number" ||
      !Number.isFinite(stamp)
    )
      return;
    const id = JSON.stringify([normalizeEmail(email), second(stamp)]);
    const matches = rowIdentities.get(id) ?? [];
    matches.push(index);
    rowIdentities.set(id, matches);
  });
  const byKey = new Map(
    submissions.map((submission) => [submission.key, submission]),
  );
  const writes: { key: string; row: number; column: number }[] = [];
  const responses = rydUncheckedSheet(
    keys,
    submissions,
    "write-unconfirmed",
  ).responses.map((response): RydSheetResponse => {
    const submission = byKey.get(response.key);
    if (!submission)
      return { ...response, outcome: "missing", reason: "response-missing" };
    const id = identity(submission);
    if (!id)
      return { ...response, outcome: "missing", reason: "identity-missing" };
    if (identities.get(id) !== 1)
      return {
        ...response,
        outcome: "ambiguous",
        reason: "multiple-responses",
      };
    const matches = rowIdentities.get(id) ?? [];
    if (!matches.length)
      return { ...response, outcome: "missing", reason: "row-missing" };
    if (matches.length !== 1)
      return { ...response, outcome: "ambiguous", reason: "multiple-rows" };
    const index = matches[0];
    const row = index + 2;
    const value = rows[index][columns.verified];
    if (typeof value === "string" && value.trim() === "✅")
      return { ...response, row, outcome: "already-ticked" };
    if (value !== undefined && value !== null && value !== "")
      return {
        ...response,
        row,
        outcome: "ambiguous",
        reason: "existing-value",
      };
    writes.push({ key: response.key, row, column: columns.verified });
    return { ...response, row };
  });
  return { responses, writes };
}
