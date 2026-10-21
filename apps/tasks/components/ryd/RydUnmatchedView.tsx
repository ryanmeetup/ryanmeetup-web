"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  FiCheck,
  FiChevronDown,
  FiExternalLink,
  FiGrid,
  FiList,
  FiRotateCcw,
  FiTrash2,
} from "react-icons/fi";
import {
  AnimatedCollapse,
  Button,
  DropdownSelect,
  IconButton,
  type DropdownSelectOption,
} from "@ryanmeetup/ui";
import type { RydSubmission, RydSubmitter } from "@/lib/ryd/matching";
import type { RydQueue } from "@/lib/ryd/queue-types";
import { isRydContactEmail } from "@/lib/ryd/normalize";
import { RydSelectCheckbox } from "./RydSelection";
import { RydContactedChip } from "./RydStatusChip";
import {
  EvidenceTile,
  noteText,
  PLATFORM_ICONS,
  RydCardFooter,
  RydSubmissionCard,
} from "./RydSubmissionCard";

export type RydUnmatchedLayout = "cards" | "table";

const LAYOUTS = [
  { value: "cards", label: "Cards", icon: FiGrid },
  { value: "table", label: "Table", icon: FiList },
] as const;

/** Thumbnails a table row shows before it summarizes the rest. */
const ROW_TILES = 4;

function latestTime(submitter: RydSubmitter) {
  return Math.max(
    0,
    ...submitter.submissions.map((s) => Date.parse(s.submittedAtIso) || 0),
  );
}

export function RydUnmatchedLayoutToggle({
  layout,
  onChange,
}: {
  layout: RydUnmatchedLayout;
  onChange: (layout: RydUnmatchedLayout) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Layout"
      className="flex shrink-0 self-start rounded-lg border border-black/10 p-0.5 dark:border-white/10"
    >
      {LAYOUTS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={layout === value}
          onClick={() => onChange(value)}
          className={`view-button py-1.5 [&_svg]:size-4 ${layout === value ? "view-button-active" : ""}`}
        >
          <Icon aria-hidden /> {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Form answers no order has claimed, newest first: as a masonry of full
 * cards for reading the evidence, or a table for working down the list.
 */
export function RydUnmatchedView({
  submitters,
  dismissed,
  contacts,
  layout,
  orderOptions,
  linking,
  busy,
  contacting,
  onLink,
  onRemove,
  onRestore,
  onMarkContacted,
  selection,
}: {
  submitters: RydSubmitter[];
  dismissed: RydSubmission[];
  contacts: RydQueue["contacts"];
  layout: RydUnmatchedLayout;
  orderOptions: DropdownSelectOption[];
  linking: string | null;
  /** A response being removed or restored; every control waits on it. */
  busy: string | null;
  /** The submitter email being marked contacted. */
  contacting: string | null;
  onLink: (submitter: RydSubmitter, orderId: string) => void;
  onRemove: (submission: RydSubmission) => void;
  onRestore: (submission: RydSubmission) => void;
  onMarkContacted: (email: string) => void;
  /** Stable submitter keys ticked for the bulk actions above the list. */
  selection: {
    selected: ReadonlySet<string>;
    onToggle: (key: string) => void;
    disabled?: boolean;
  };
}) {
  const newestFirst = useMemo(
    () => [...submitters].sort((a, b) => latestTime(b) - latestTime(a)),
    [submitters],
  );
  const results =
    layout === "cards" ? (
      <UnmatchedCards
        submitters={newestFirst}
        contacts={contacts}
        linkControl={linkControl}
        removeControl={removeControl}
        contactControl={contactControl}
        selectControl={selectControl}
      />
    ) : (
      <UnmatchedTable
        submitters={newestFirst}
        contacts={contacts}
        linkControl={linkControl}
        removeControl={removeControl}
        contactControl={contactControl}
        selectControl={selectControl}
      />
    );
  return (
    <div className="space-y-6">
      {submitters.length > 0 && results}
      {dismissed.length > 0 && (
        <RemovedResponses
          dismissed={dismissed}
          busy={busy}
          onRestore={onRestore}
        />
      )}
    </div>
  );

  function removeControl(submission: RydSubmission) {
    return (
      <IconButton
        label={`Remove the response sent ${submission.submittedAt || "without a date"}`}
        variant="danger"
        size="sm"
        disabled={busy !== null || linking !== null || contacting !== null}
        onClick={() => onRemove(submission)}
      >
        <FiTrash2 aria-hidden />
      </IconButton>
    );
  }

  function linkControl(submitter: RydSubmitter) {
    return (
      <DropdownSelect
        variant="compact"
        label="Link to order"
        options={orderOptions}
        value=""
        onChange={(orderId) => onLink(submitter, orderId)}
        searchPlaceholder="Search orders"
        menuWidth="wide"
        disabled={
          selection.disabled ||
          linking !== null ||
          busy !== null ||
          contacting !== null ||
          !orderOptions.length
        }
      />
    );
  }

  function selectControl(submitter: RydSubmitter) {
    const name =
      submitter.submissions.find((s) => s.legalName)?.legalName ||
      submitter.email;
    return (
      <RydSelectCheckbox
        label={`Select ${name}`}
        checked={selection.selected.has(submitter.key)}
        disabled={selection.disabled || !isRydContactEmail(submitter.email)}
        onToggle={() => selection.onToggle(submitter.key)}
      />
    );
  }

  function contactControl(submitter: RydSubmitter) {
    return (
      <Button
        type="button"
        size="xs"
        variant="secondary"
        leftIcon={<FiCheck aria-hidden />}
        aria-label={`Mark ${submitter.email} as contacted`}
        loading={contacting === submitter.email}
        loadingText="Marking..."
        disabled={
          selection.disabled ||
          linking !== null ||
          busy !== null ||
          contacting !== null ||
          !isRydContactEmail(submitter.email)
        }
        onClick={() => onMarkContacted(submitter.email)}
      >
        Mark contacted
      </Button>
    );
  }
}

type Controls = {
  submitters: RydSubmitter[];
  contacts: RydQueue["contacts"];
  linkControl: (submitter: RydSubmitter) => ReactNode;
  removeControl: (submission: RydSubmission) => ReactNode;
  contactControl: (submitter: RydSubmitter) => ReactNode;
  selectControl: (submitter: RydSubmitter) => ReactNode;
};

/**
 * One block per person. Several responses from one email are one person
 * answering twice, so they share a frame and a single link control, and each
 * can be removed on its own.
 */
function UnmatchedCards({
  submitters,
  contacts,
  linkControl,
  removeControl,
  contactControl,
  selectControl,
}: Controls) {
  return (
    <div className="columns-1 gap-4 xl:columns-2 2xl:columns-3">
      {submitters.map((submitter) =>
        submitter.submissions.length === 1 ? (
          <div key={submitter.key} className="mb-4 break-inside-avoid">
            <RydSubmissionCard
              submission={submitter.submissions[0]}
              badge={<RydContactedChip contact={contacts[submitter.email]} />}
              action={selectControl(submitter)}
              footer={
                <>
                  {linkControl(submitter)}
                  {contactControl(submitter)}
                  <span className="ml-auto">
                    {removeControl(submitter.submissions[0])}
                  </span>
                </>
              }
            />
          </div>
        ) : (
          <section
            key={submitter.key}
            aria-label={`${submitter.submissions.length} responses from ${submitter.email}`}
            className="mb-4 space-y-3 break-inside-avoid rounded-2xl border border-dashed border-black/15 p-3 dark:border-white/15"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/70 dark:text-white/70">
                  {submitter.submissions.length} responses, same email
                </p>
                <RydContactedChip contact={contacts[submitter.email]} />
              </div>
              {selectControl(submitter)}
            </div>
            {submitter.submissions.map((submission) => (
              <RydSubmissionCard
                key={submission.key}
                submission={submission}
                footer={
                  <span className="ml-auto">{removeControl(submission)}</span>
                }
              />
            ))}
            <RydCardFooter>
              {linkControl(submitter)}
              {contactControl(submitter)}
            </RydCardFooter>
          </section>
        ),
      )}
    </div>
  );
}

function UnmatchedTable({
  submitters,
  contacts,
  linkControl,
  removeControl,
  contactControl,
  selectControl,
}: Controls) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed text-left text-sm">
          <caption className="sr-only">Unmatched submissions</caption>
          <colgroup>
            <col className="w-10" />
            <col className="w-[22%]" />
            <col className="w-[13%]" />
            <col className="w-[21%]" />
            <col className="w-[22%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="border-b border-black/10 bg-black/[0.025] text-[10px] uppercase tracking-[0.16em] text-black/60 dark:border-white/10 dark:bg-white/[0.025] dark:text-white/60">
            <tr>
              <th className="py-3 pl-4">
                <span className="sr-only">Selected</span>
              </th>
              <th className="px-4 py-3 font-semibold">Ryan</th>
              <th className="px-3 py-3 font-semibold">Sent</th>
              <th className="px-3 py-3 font-semibold">Evidence</th>
              <th className="px-3 py-3 font-semibold">Links and notes</th>
              <th className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/10">
            {submitters.map((submitter) => {
              const { submissions } = submitter;
              const name =
                submissions.find((s) => s.legalName)?.legalName ||
                "No name given";
              const fileIds = submissions.flatMap((s) => s.fileIds);
              // A second response often repeats the first one's links.
              const links = [
                ...new Map(
                  submissions
                    .flatMap((s) => s.socialLinks)
                    .map((link) => [link.url, link]),
                ).values(),
              ];
              const notes = submissions
                .map((s) => noteText(s.socialText))
                .filter((note): note is string => Boolean(note));
              return (
                <tr
                  key={submitter.key}
                  className="align-top transition hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"
                >
                  <td className="py-2.5 pl-4">{selectControl(submitter)}</td>
                  <td className="px-4 py-2.5">
                    <span className="block truncate font-semibold" title={name}>
                      {name}
                    </span>
                    <span
                      className="block truncate text-xs text-black/70 dark:text-white/70"
                      title={submitter.email}
                    >
                      {submitter.email || "No email given"}
                    </span>
                    {contacts[submitter.email] && (
                      <span className="mt-1 block">
                        <RydContactedChip contact={contacts[submitter.email]} />
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-black/70 dark:text-white/70">
                    <ul
                      aria-label={`${submissions.length} response${submissions.length === 1 ? "" : "s"}`}
                    >
                      {submissions.map((submission) => (
                        <li
                          key={submission.key}
                          className="flex items-center justify-between gap-1"
                        >
                          <span className="truncate">
                            {submission.submittedAt || "No date"}
                          </span>
                          {removeControl(submission)}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-2.5">
                    {fileIds.length ? (
                      <div className="flex items-center gap-1.5">
                        {fileIds.slice(0, ROW_TILES).map((fileId, index) => (
                          <div key={fileId} className="w-10 shrink-0">
                            <EvidenceTile fileId={fileId} index={index} />
                          </div>
                        ))}
                        {fileIds.length > ROW_TILES && (
                          <span className="text-xs font-semibold text-black/70 dark:text-white/70">
                            +{fileIds.length - ROW_TILES}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-black/70 dark:text-white/70">
                        No files
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {links.length > 0 && (
                      <ul
                        className="flex flex-wrap gap-1.5"
                        aria-label="Social links"
                      >
                        {links.map((link) => (
                          <li key={link.url}>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={link.url}
                              className="inline-flex max-w-full items-center gap-1 rounded-full border border-black/10 px-2 py-0.5 text-xs font-semibold text-black/75 transition hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:text-white/75 dark:hover:border-white/30 dark:focus-visible:ring-white/40"
                            >
                              {PLATFORM_ICONS[link.platform]}
                              <span className="truncate">{link.label}</span>
                              <FiExternalLink
                                aria-hidden
                                className="shrink-0 opacity-60"
                              />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    {notes.length > 0 && (
                      <p
                        className={`line-clamp-2 text-xs text-black/70 dark:text-white/70 ${links.length ? "mt-1.5" : ""}`}
                        title={notes.join("\n\n")}
                      >
                        {notes.join(" · ")}
                      </p>
                    )}
                    {!links.length && !notes.length && (
                      <span className="text-xs text-black/70 dark:text-white/70">
                        None
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col items-end gap-2">
                      {linkControl(submitter)}
                      {contactControl(submitter)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Responses set aside, tucked away but a click from coming back. */
function RemovedResponses({
  dismissed,
  busy,
  onRestore,
}: {
  dismissed: RydSubmission[];
  busy: string | null;
  onRestore: (submission: RydSubmission) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="border-t border-black/10 pt-4 dark:border-white/10">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded text-xs font-semibold uppercase tracking-[0.16em] text-black/70 transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/70 dark:hover:text-white dark:focus-visible:ring-white/40"
      >
        <FiChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
        Removed responses {dismissed.length}
      </button>
      <AnimatedCollapse id={panelId} open={open}>
        <ul className="mt-3 divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/10 dark:border-white/10">
          {dismissed.map((submission) => (
            <li
              key={submission.key}
              className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {submission.legalName || "No name given"}
                </p>
                <p className="truncate text-xs text-black/70 dark:text-white/70">
                  {submission.email} · {submission.submittedAt || "No date"} ·{" "}
                  {submission.fileIds.length} file
                  {submission.fileIds.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                leftIcon={<FiRotateCcw aria-hidden />}
                disabled={busy !== null}
                loading={busy === submission.key}
                aria-label={`Restore the response from ${submission.legalName || submission.email} sent ${submission.submittedAt || "without a date"}`}
                tabIndex={open ? undefined : -1}
                onClick={() => onRestore(submission)}
              >
                Restore
              </Button>
            </li>
          ))}
        </ul>
      </AnimatedCollapse>
    </div>
  );
}
