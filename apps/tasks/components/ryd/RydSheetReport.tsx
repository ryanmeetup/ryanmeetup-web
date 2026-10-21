"use client";

import { useState } from "react";
import {
  Button,
  DisclosureCard,
  Heading,
  Pagination,
  StatCard,
} from "@ryanmeetup/ui";
import type {
  RydSheetIssue,
  RydSheetReport as SheetReport,
  RydSheetResponse,
} from "@/lib/ryd/sheet-reconciliation";

const issues: Record<RydSheetIssue, string> = {
  "not-required": "This batch has no form responses to tick.",
  "already-confirmed":
    "This batch was already marked sent. Its earlier sheet result is unavailable here. Check the sheet manually; confirming again does not repeat sheet writes.",
  disconnected:
    "Google is disconnected. Check and tick this batch’s responses manually.",
  "no-linked-sheet":
    "No linked response spreadsheet is available. Check this batch’s responses manually if you keep a sheet.",
  "tab-missing":
    "No response tab could be validated against the form questions and unique Timestamp, email, and Verified? columns. No cells were changed.",
  "tab-ambiguous":
    "More than one tab matches the response schema. No cells were changed. Check the correct response tab manually.",
  "google-unavailable":
    "Google could not return the response sheet. No sheet update was attempted. Check this batch’s responses manually.",
  "write-unconfirmed":
    "Google did not confirm the sheet update. Some cells may have changed. Check the unchecked responses manually before editing; the write will not be repeated automatically.",
};

const outcomes: Record<RydSheetResponse["outcome"], string> = {
  updated: "Updated",
  "already-ticked": "Already ticked",
  missing: "Missing",
  ambiguous: "Ambiguous",
  unchecked: "Unchecked",
};
const reasons: Record<NonNullable<RydSheetResponse["reason"]>, string> = {
  "response-missing": "This saved response is no longer returned by the form.",
  "identity-missing":
    "A usable email and submission time are required to match a row.",
  "row-missing": "No row has the same email and submission second.",
  "multiple-responses":
    "Multiple form responses share this email and submission second.",
  "multiple-rows":
    "Multiple sheet rows share this email and submission second.",
  "existing-value":
    "The Verified? cell already contains another value. It was left unchanged.",
};

export function RydSheetReport({ report }: { report: SheetReport }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const unresolved = (response: RydSheetResponse) =>
    !["updated", "already-ticked"].includes(response.outcome);
  const responses = [...report.responses].sort(
    (a, b) => Number(unresolved(b)) - Number(unresolved(a)),
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(responses.length / pageSize)),
  );
  const visible = responses.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  return (
    <section className="space-y-4" aria-label="Response sheet results">
      <Heading size="h3">Response sheet</Heading>
      {report.issue && (
        <p className="text-sm text-black/70 dark:text-white/70">
          {issues[report.issue]}
        </p>
      )}
      {responses.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(outcomes).map(([outcome, label]) => (
              <StatCard
                key={outcome}
                label={label}
                value={
                  responses.filter((response) => response.outcome === outcome)
                    .length
                }
              />
            ))}
          </div>
          <p className="text-sm text-black/70 dark:text-white/70">
            Updated and already ticked responses matched uniquely. Missing,
            ambiguous, and unchecked responses need a manual check. These
            results are available until you close this dialog.
          </p>
          <DisclosureCard
            summary={`Response details (${responses.length})`}
            defaultOpen={responses.some(unresolved)}
          >
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {visible.map((response) => (
                <li
                  key={response.key}
                  className="space-y-1 py-3 text-sm [overflow-wrap:anywhere]"
                >
                  <p className="font-semibold">
                    {response.legalName ||
                      response.email ||
                      "Unavailable response"}{" "}
                    · {outcomes[response.outcome]}
                  </p>
                  {response.email && <p>{response.email}</p>}
                  {response.submittedAt && (
                    <p className="text-black/70 dark:text-white/70">
                      Submitted {response.submittedAt}
                    </p>
                  )}
                  {!response.legalName && !response.email && (
                    <p className="text-black/70 dark:text-white/70">
                      Response reference: {response.key}
                    </p>
                  )}
                  {response.row && (
                    <p>
                      Row {response.row}
                      {report.sheetTitle ? ` in ${report.sheetTitle}` : ""}
                    </p>
                  )}
                  {response.reason && (
                    <p className="text-black/70 dark:text-white/70">
                      {reasons[response.reason]}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {responses.length > 10 && (
              <Pagination
                page={currentPage}
                pageSize={pageSize}
                totalCount={responses.length}
                itemLabel="responses"
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
          </DisclosureCard>
        </>
      )}
      {report.spreadsheetId && (
        <Button.Link
          href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(report.spreadsheetId)}/edit${report.sheetId !== undefined ? `#gid=${report.sheetId}` : ""}`}
          newTab
          variant="secondary"
          className="w-full sm:w-auto"
        >
          Open response spreadsheet
        </Button.Link>
      )}
    </section>
  );
}
