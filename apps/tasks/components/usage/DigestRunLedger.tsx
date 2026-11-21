"use client";

import { FiClock } from "react-icons/fi";
import { Card, EmptyState } from "@ryanmeetup/ui";
import { formatTimestamp } from "@/lib/date-format";
import {
  DIGEST_OUTCOME_LABEL,
  type DigestRun,
  type DigestRunOutcome,
} from "@/lib/usage/digest-run-types";

const outcomeStyles: Record<DigestRunOutcome, string> = {
  sent: "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  empty:
    "border-black/15 bg-black/[0.04] text-black/65 dark:border-white/15 dark:bg-white/[0.06] dark:text-white/65",
  off_schedule:
    "border-black/15 bg-black/[0.04] text-black/65 dark:border-white/15 dark:bg-white/[0.06] dark:text-white/65",
  paused:
    "border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-100",
  unconfigured:
    "border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-100",
  failed: "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300",
};

function OutcomeBadge({ outcome }: { outcome: DigestRunOutcome }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-caps-tight ${outcomeStyles[outcome]}`}
    >
      {DIGEST_OUTCOME_LABEL[outcome]}
    </span>
  );
}

/** One-line explanation of what a run did, so the table needs no legend. */
const summarize = (run: DigestRun) => {
  if (run.detail) return run.detail;
  if (run.outcome === "sent")
    return `${run.scheduledCount} sent, ${run.skippedCount} with nothing to send${
      run.failedCount ? `, ${run.failedCount} failed` : ""
    }`;
  return `${run.skippedCount} recipient${run.skippedCount === 1 ? "" : "s"} reviewed`;
};

/**
 * The delivery ledger. Its job is to answer "why did no digest arrive?"
 * without a log drain: a paused workspace, a missing credential, and a day
 * where nobody had actionable work all look identical from an empty inbox.
 */
export function DigestRunLedger({ runs }: { runs: DigestRun[] }) {
  return (
    <section aria-label="Recent digest runs" className="space-y-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-caps-tight text-black/50 dark:text-white/50">
        Recent digest runs
      </h3>
      <Card variant="solid" size="none" className="overflow-hidden">
        {runs.length === 0 ? (
          <EmptyState icon={<FiClock />}
            variant="plain"
            message="No digest runs have been recorded yet. Runs appear here once the worker has executed on this schedule."
          />
        ) : (
          <>
            <div className="divide-y divide-black/10 dark:divide-white/10 xl:hidden">
              {runs.map((run) => (
                <article key={run.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <time
                      dateTime={run.ranAt}
                      className="text-sm font-semibold"
                    >
                      {formatTimestamp(run.ranAt)}
                    </time>
                    <OutcomeBadge outcome={run.outcome} />
                  </div>
                  <p className="text-xs text-black/60 dark:text-white/60">
                    {summarize(run)}
                  </p>
                </article>
              ))}
            </div>

            <div className="hidden overflow-hidden xl:block">
              <table className="w-full table-fixed text-left text-sm">
                <caption className="sr-only">Recent digest runs</caption>
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                  <col className="w-[46%]" />
                </colgroup>
                <thead className="border-b border-black/10 bg-black/[0.025] text-[10px] uppercase tracking-caps-tight text-black/50 dark:border-white/10 dark:bg-white/[0.025] dark:text-white/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Ran</th>
                    <th className="px-4 py-3 font-semibold">Outcome</th>
                    <th className="px-4 py-3 font-semibold">Trigger</th>
                    <th className="px-4 py-3 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 dark:divide-white/10">
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className="transition hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">
                        <time dateTime={run.ranAt}>
                          {formatTimestamp(run.ranAt)}
                        </time>
                      </td>
                      <td className="px-4 py-3">
                        <OutcomeBadge outcome={run.outcome} />
                      </td>
                      <td className="px-4 py-3 text-black/65 dark:text-white/65">
                        {run.source === "manual" ? "Manual" : "Schedule"}
                      </td>
                      <td className="px-4 py-3 text-black/65 dark:text-white/65">
                        {summarize(run)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
