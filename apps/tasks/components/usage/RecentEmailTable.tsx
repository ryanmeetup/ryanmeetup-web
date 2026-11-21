"use client";

import { useEffect, useState } from "react";
import { usePagination, useSearchFilter } from "@ryanmeetup/hooks";
import {
  Card,
  EmptyState,
  Input,
  Pagination,
  PendingResults,
} from "@ryanmeetup/ui";
import { FiLoader, FiMail, FiSearch } from "react-icons/fi";
import type { ResendEmailSummary } from "@/lib/usage/resend-usage-types";
import { EmailDetailModal } from "./EmailDetailModal";
import { EmailStatusBadge, emailStatusLabel } from "./EmailStatusBadge";
import { formatTimestamp } from "@/lib/date-format";

const emailSearchText = (email: ResendEmailSummary) =>
  [
    email.subject,
    email.lastEvent,
    emailStatusLabel(email.lastEvent),
    formatTimestamp(email.createdAt),
    email.scheduledAt ? formatTimestamp(email.scheduledAt) : "",
    email.recipients.join(" "),
  ]
    .join(" ")
    .toLowerCase();

const emailTiming = (email: ResendEmailSummary) => {
  if (email.lastEvent === "scheduled" && email.scheduledAt) {
    return {
      dateTime: email.scheduledAt,
      label: `Scheduled ${formatTimestamp(email.scheduledAt)}`,
    };
  }
  if (email.lastEvent === "canceled" && email.scheduledAt) {
    return {
      dateTime: email.scheduledAt,
      label: `Canceled before ${formatTimestamp(email.scheduledAt)}`,
    };
  }
  return {
    dateTime: email.createdAt,
    label: formatTimestamp(email.createdAt),
  };
};

export function RecentEmailTable({ emails }: { emails: ResendEmailSummary[] }) {
  const [selectedEmail, setSelectedEmail] = useState<ResendEmailSummary | null>(
    null,
  );
  const { query, setQuery, filtered, isPending } = useSearchFilter({
    data: emails,
    buildHaystack: emailSearchText,
    queryParam: "emailSearch",
  });
  const { page, pageSize, setPage, setPageSize, syncPage } = usePagination();
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleEmails = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    if (page !== currentPage) syncPage(currentPage);
  }, [currentPage, page, syncPage]);

  return (
    <section aria-label="Recent email activity" className="space-y-3">
      <div className="relative">
        <Input
          label="Search recent email activity"
          name="email-activity-search"
          hideLabel
          leadingIcon={<FiSearch aria-hidden />}
          aria-busy={isPending}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by subject, recipient, date, or delivery state..."
          inputClassName="pr-10"
        />
        {isPending && (
          <span
            role="status"
            aria-label="Loading email activity results"
            className="absolute bottom-3 right-3 text-black/45 dark:text-white/45"
          >
            <FiLoader className="animate-spin motion-reduce:animate-none" />
          </span>
        )}
      </div>

      <PendingResults
        pending={isPending}
        label="Loading email activity"
        className="rounded-2xl"
      >
        <Card variant="solid" size="none" className="overflow-hidden">
          <div className="border-b border-black/10 px-4 py-3 dark:border-white/10 xl:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-caps-tight text-black/50 dark:text-white/50">
              Recent email activity
            </p>
          </div>
          <div className="divide-y divide-black/10 dark:divide-white/10 xl:hidden">
            {visibleEmails.map((email) => (
              <article key={email.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 text-left font-semibold underline decoration-black/20 underline-offset-4 transition hover:decoration-black focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 dark:decoration-white/25 dark:hover:decoration-white dark:focus-visible:ring-white/70"
                    onClick={() => setSelectedEmail(email)}
                  >
                    {email.subject}
                  </button>
                  <span className="shrink-0">
                    <EmailStatusBadge status={email.lastEvent} />
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-xs text-black/55 dark:text-white/55">
                  <time dateTime={emailTiming(email).dateTime}>
                    {emailTiming(email).label}
                  </time>
                  <span className="break-all text-right">
                    {email.recipients.join(", ") || "Recipient unavailable"}
                  </span>
                </div>
              </article>
            ))}
            {visibleEmails.length === 0 && (
              <EmptyState icon={<FiMail />}
                variant="plain"
                message={
                  emails.length === 0
                    ? "No recent email activity is available."
                    : "No email activity matches that search."
                }
              />
            )}
          </div>

          <div className="hidden overflow-hidden xl:block">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Recent email activity</caption>
              <colgroup>
                <col className="w-[38%]" />
                <col className="w-[18%]" />
                <col className="w-[26%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead className="border-b border-black/10 bg-black/[0.025] text-[10px] uppercase tracking-caps-tight text-black/50 dark:border-white/10 dark:bg-white/[0.025] dark:text-white/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Recipients</th>
                  <th className="px-4 py-3 font-semibold">Timing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {visibleEmails.map((email) => (
                  <tr
                    key={email.id}
                    className="transition hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"
                  >
                    <td className="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        className="block max-w-full truncate text-left underline decoration-black/20 underline-offset-4 transition hover:decoration-black focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 dark:decoration-white/25 dark:hover:decoration-white dark:focus-visible:ring-white/70"
                        title={email.subject}
                        onClick={() => setSelectedEmail(email)}
                      >
                        {email.subject}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <EmailStatusBadge status={email.lastEvent} />
                    </td>
                    <td className="px-4 py-3 text-black/65 dark:text-white/65">
                      <span className="block break-all">
                        {email.recipients.join(", ") || "Unavailable"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-black/55 dark:text-white/55">
                      <time dateTime={emailTiming(email).dateTime}>
                        {emailTiming(email).label}
                      </time>
                    </td>
                  </tr>
                ))}
                {visibleEmails.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState icon={<FiMail />}
                        variant="plain"
                        message={
                          emails.length === 0
                            ? "No recent email activity is available."
                            : "No email activity matches that search."
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            totalCount={filtered.length}
            itemLabel="emails"
            itemLabelSingular="email"
            disabled={isPending}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      </PendingResults>

      {selectedEmail && (
        <EmailDetailModal
          key={selectedEmail.id}
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
        />
      )}
    </section>
  );
}
