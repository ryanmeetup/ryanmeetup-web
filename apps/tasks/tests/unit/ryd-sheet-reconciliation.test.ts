import { describe, expect, it } from "vitest";
import { sheetSerial } from "@/lib/ryd/form-responses";
import type { RydSubmission } from "@/lib/ryd/matching";
import {
  planRydSheetReconciliation,
  rydResponseSheetColumns,
} from "@/lib/ryd/sheet-reconciliation";

const zone = "America/New_York";
const submission: RydSubmission = {
  key: "saved-response",
  email: "ryan@example.test",
  legalName: "Ryan Example",
  submittedAtIso: "2026-10-21T16:00:00.400Z",
  submittedAt: "10/21/2026 12:00 PM",
  fileIds: [],
  socialText: "",
  socialLinks: [],
  otherAnswers: [],
};
const headers = ["Timestamp", "Your email", "Legal name", "Verified?"];
const titles = ["Your email", "Legal name"];
const columns = { timestamp: 0, email: 1, verified: 3 };
const stamp = sheetSerial(submission.submittedAtIso, zone);
const row = [stamp, submission.email, submission.legalName, ""];
const plan = (
  rows: unknown[][],
  submissions = [submission],
  keys = [submission.key],
) => planRydSheetReconciliation(rows, columns, submissions, keys, zone);

describe("RY-D response sheet reconciliation", () => {
  it("validates unique columns and the current form's question titles", () => {
    expect(rydResponseSheetColumns(headers, titles)).toEqual(columns);
    expect(
      rydResponseSheetColumns(headers, ["Another form's question"]),
    ).toBeNull();
    expect(rydResponseSheetColumns(headers, [])).toBeNull();
    expect(rydResponseSheetColumns(headers, [""])).toBeNull();
    expect(
      rydResponseSheetColumns(headers, ["Your email", "Your email"]),
    ).toBeNull();
  });
  it.each([
    "Timestamp",
    "Your email",
    "Other email",
    "Verified?",
    "Legal name",
  ])("refuses duplicate or conflicting headers: %s", (extra) => {
    expect(rydResponseSheetColumns([...headers, extra], titles)).toBeNull();
  });
  it("matches one second and normalized email, with exactly one planned cell", () => {
    const result = plan([
      [stamp + 0.8 / 86400, "  RYAN@EXAMPLE.TEST  ", "Ryan", ""],
    ]);
    expect(result.writes).toEqual([{ key: submission.key, row: 2, column: 3 }]);
    // Only a confirmed Google write changes this to 'updated'.
    expect(result.responses[0]).toMatchObject({
      outcome: "unchecked",
      row: 2,
      email: submission.email,
    });
  });
  it.each([-1, 1])("does not match a neighboring second (%s)", (offset) => {
    const result = plan([[stamp + offset / 86400, submission.email]]);
    expect(result.writes).toEqual([]);
    expect(result.responses[0]).toMatchObject({
      outcome: "missing",
      reason: "row-missing",
    });
  });
  it.each(["", "different@example.test", 123, null, undefined, "not an email"])(
    "never bypasses row email identity (%s)",
    (email) => {
      expect(plan([[stamp, email]]).writes).toEqual([]);
    },
  );
  it("leaves duplicate sheet rows ambiguous even when one is already ticked", () => {
    const result = plan([row, [stamp, submission.email, "Ryan", "✅"]]);
    expect(result.writes).toEqual([]);
    expect(result.responses[0]).toMatchObject({
      outcome: "ambiguous",
      reason: "multiple-rows",
    });
  });
  it("refuses collisions with an unselected response in the entire form", () => {
    const other = {
      ...submission,
      key: "not-in-batch",
      submittedAtIso: "2026-10-21T16:00:00.900Z",
    };
    const result = plan([row], [submission, other]);
    expect(result.writes).toEqual([]);
    expect(result.responses[0]).toMatchObject({
      outcome: "ambiguous",
      reason: "multiple-responses",
    });
  });
  it("refuses daylight-saving fold collisions", () => {
    const first = { ...submission, submittedAtIso: "2026-11-01T05:30:00Z" };
    const second = {
      ...submission,
      key: "second",
      submittedAtIso: "2026-11-01T06:30:00Z",
    };
    const result = plan(
      [[sheetSerial(first.submittedAtIso, zone), first.email]],
      [first, second],
    );
    expect(result.responses[0].reason).toBe("multiple-responses");
    expect(result.writes).toEqual([]);
  });
  it.each(["another decision", "not ✅", false, 0, '=IF(A2="", "", "✅")'])(
    "preserves a nonempty Verified? value (%s)",
    (value) => {
      const result = plan([[stamp, submission.email, "Ryan", value]]);
      expect(result.writes).toEqual([]);
      expect(result.responses[0]).toMatchObject({
        outcome: "ambiguous",
        reason: "existing-value",
      });
    },
  );
  it("distinguishes already ticked, missing rows, and deleted responses", () => {
    const missing = {
      ...submission,
      key: "no-row",
      email: "missing@example.test",
    };
    const result = plan(
      [[stamp, submission.email, "Ryan", "✅"]],
      [submission, missing],
      [submission.key, missing.key, "deleted"],
    );
    expect(result.writes).toEqual([]);
    expect(
      result.responses.map(({ outcome, reason }) => [outcome, reason]),
    ).toEqual([
      ["already-ticked", undefined],
      ["missing", "row-missing"],
      ["missing", "response-missing"],
    ]);
  });
  it.each([
    { email: "" },
    { email: "invalid" },
    { submittedAtIso: "" },
    { submittedAtIso: "invalid" },
  ])("reports unusable source identity: %o", (changes) => {
    const result = plan([row], [{ ...submission, ...changes }]);
    expect(result.writes).toEqual([]);
    expect(result.responses[0].reason).toBe("identity-missing");
  });
  it("deduplicates pinned keys and does not write unselected rows", () => {
    const other = { ...submission, key: "other", email: "other@example.test" };
    const result = plan(
      [row, [stamp, other.email]],
      [submission, other],
      [submission.key, submission.key],
    );
    expect(result.responses).toHaveLength(1);
    expect(result.writes).toHaveLength(1);
  });
});
