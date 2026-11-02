"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useQueryParamState, useSearchFilter } from "@ryanmeetup/hooks";
import {
  Button,
  ClearFiltersButton,
  ConfirmationDialog,
  EmptyState,
  Pagination,
  PendingResults,
  SearchInput,
  toast,
} from "@ryanmeetup/ui";
import { FiCalendar, FiCheckSquare, FiHash, FiMail } from "react-icons/fi";
import { derivePagination } from "@/lib/pagination";
import { usePagination } from "@/hooks/usePagination";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import { RYD_STATUS_LABELS } from "@/lib/ryd/orders";
import type { RydSubmission, RydSubmitter } from "@/lib/ryd/matching";
import { isRydContactEmail } from "@/lib/ryd/normalize";
import { changeRydLinks } from "@/lib/ryd/ryd-decisions";
import {
  reconcileRydQueue,
  type RydQueueChange,
} from "@/lib/ryd/queue-reconciliation";
import type { RydQueue } from "@/lib/ryd/queue-types";
import { contactableSubmitters, linkableOrders } from "@/lib/ryd/queue-view";
import {
  rydSubmitterSearchText,
  sortRydSubmitters,
} from "@/lib/ryd/submission-view";
import {
  RYD_BULK_BODY_BYTES,
  RYD_BULK_LIMIT,
  rydBodyBytes,
  type RydContactResult,
} from "@/lib/ryd/bulk-operations";
import { RydContactDialog } from "./RydContactDialog";
import { RydSelectionBar } from "./RydSelection";
import { RYD_STATUS_ICONS, RYD_STATUS_TEXT } from "./RydStatusChip";
import { RydUnmatchedLayoutToggle, RydUnmatchedView } from "./RydUnmatchedView";

/**
 * Form answers no order has claimed: search, link to an order, contact, or
 * set aside.
 */
export function RydUnmatchedSection({
  queue,
  unmatched,
  selected,
  setSelected,
  refreshing,
  refresh,
  reconcile,
  onLinked,
}: {
  queue: RydQueue;
  unmatched: RydSubmitter[];
  selected: ReadonlySet<string>;
  setSelected: Dispatch<SetStateAction<ReadonlySet<string>>>;
  refreshing: boolean;
  refresh: () => Promise<void>;
  reconcile: (apply: (current: RydQueue) => RydQueue) => void;
  /** Open the order a response was just linked to. */
  onLinked: (orderId: string) => void;
}) {
  const [layoutParam, setLayoutParam] = useQueryParamState("layout");
  const layout = layoutParam === "table" ? "table" : "cards";
  const [linking, setLinking] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RydSubmission | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [emailing, setEmailing] = useState<"all" | "selected" | null>(null);
  /** Emails being recorded as contacted without a draft. */
  const [recording, setRecording] = useState<string[] | null>(null);
  const contacting = recording !== null;

  const {
    query,
    setQuery,
    filtered,
    isPending: searchPending,
  } = useSearchFilter({
    data: unmatched,
    buildHaystack: rydSubmitterSearchText,
    queryParam: "submissionSearch",
  });
  const sorted = useMemo(() => sortRydSubmitters(filtered), [filtered]);
  const selectable = useMemo(
    () => sorted.filter((submitter) => isRydContactEmail(submitter.email)),
    [sorted],
  );
  const contactable = useMemo(
    () => contactableSubmitters(sorted, queue.contacts),
    [sorted, queue.contacts],
  );
  const selectedSubmitters = useMemo(
    () => selectable.filter((submitter) => selected.has(submitter.key)),
    [selectable, selected],
  );
  const busy =
    searchPending || contacting || linking !== null || dismissing !== null;

  const { page, pageSize, setPage, setPageSize, syncPage } = usePagination();
  const {
    page: currentPage,
    from,
    to,
  } = derivePagination(page, pageSize, sorted.length);
  // Saved changes can empty the last page; land on the one that's left.
  useEffect(() => {
    if (page !== currentPage) syncPage(currentPage);
  }, [currentPage, page, syncPage]);

  const orderOptions = useMemo(
    () =>
      linkableOrders(queue.orders).map((order) => {
        const StatusIcon = RYD_STATUS_ICONS[order.status];
        return {
          value: order.orderId,
          label:
            `${order.firstName} ${order.lastName}`.trim() || order.displayEmail,
          group: {
            icon: <StatusIcon aria-hidden className="h-3 w-3" />,
            label: RYD_STATUS_LABELS[order.status],
            textClassName: RYD_STATUS_TEXT[order.status],
          },
          details: [
            { icon: <FiMail aria-hidden />, text: order.displayEmail },
            { icon: <FiHash aria-hidden />, text: order.orderId },
            ...(order.orderedAt
              ? [{ icon: <FiCalendar aria-hidden />, text: order.orderedAt }]
              : []),
          ].filter((detail) => detail.text),
        };
      }),
    [queue.orders],
  );

  function applyChange(change: RydQueueChange) {
    reconcile((current) => reconcileRydQueue(current, change));
  }

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function link(submitter: RydSubmitter, orderId: string) {
    if (searchPending || linking !== null) return;
    const submissionKeys = [
      ...new Set(submitter.submissions.map((submission) => submission.key)),
    ];
    const payload = { submissionKeys, source: "manual" };
    if (
      submissionKeys.length > RYD_BULK_LIMIT ||
      rydBodyBytes(payload) > RYD_BULK_BODY_BYTES
    ) {
      toast.error(
        "This person has too many responses to link together. Link individual responses from the order review.",
      );
      onLinked(orderId);
      return;
    }
    setLinking(submitter.key);
    try {
      applyChange(await changeRydLinks(orderId, submissionKeys, true));
      toast.success("Linked. Review the order to decide.");
      onLinked(orderId);
      void refresh().catch(() => {});
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          "Those responses couldn't be linked. Nothing was partially linked.",
        ),
      );
    } finally {
      setLinking(null);
    }
  }

  function markContacted(emails: string[]) {
    if (searchPending || contacting) return;
    setRecording(emails);
  }

  function contactsRecorded(result: RydContactResult) {
    reconcile((current) => ({
      ...current,
      contacts: { ...current.contacts, ...result.contacts },
    }));
    const saved = new Set(
      Object.keys(result.contacts).map((email) => `email:${email}`),
    );
    setSelected(
      (current) => new Set([...current].filter((key) => !saved.has(key))),
    );
  }

  /** Remove a response from the queue, or with `restore`, put it back. */
  async function setDismissed(submission: RydSubmission, restore = false) {
    setDismissing(submission.key);
    try {
      await mutate("/api/ryd/dismissals", {
        method: restore ? "DELETE" : "POST",
        body: JSON.stringify({ submissionKey: submission.key }),
      });
      applyChange({ type: "dismissal", submission, dismissed: !restore });
      void refresh().catch(() => {});
      setRemoving(null);
      toast.success(
        restore
          ? "Response restored."
          : "Response removed. It stays in the Google Form.",
      );
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          restore
            ? "That response couldn't be restored."
            : "That response couldn't be removed.",
        ),
      );
    } finally {
      setDismissing(null);
    }
  }

  return (
    <>
      <section
        aria-busy={refreshing}
        aria-label="Unmatched submissions"
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-black/70 dark:text-white/70">
            Form answers no order has claimed: often a gift, a different email,
            or an order that hasn&apos;t arrived in a file yet.
          </p>
          {unmatched.length > 0 && (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full sm:w-auto"
                leftIcon={<FiMail aria-hidden />}
                onClick={() => setEmailing("all")}
                disabled={
                  searchPending ||
                  linking !== null ||
                  dismissing !== null ||
                  !contactable.length
                }
                title={
                  contactable.length
                    ? undefined
                    : "Everyone here was contacted in the last day."
                }
              >
                Email everyone ({contactable.length})
              </Button>
              <RydUnmatchedLayoutToggle
                layout={layout}
                onChange={(next) =>
                  setLayoutParam(next === "cards" ? "" : next)
                }
              />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <SearchInput
              label="Search submissions"
              hideLabel={false}
              name="submissionSearch"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search by Ryan, email, or answer..."
              pending={searchPending}
              pendingLabel="Loading submission results"
            />
          </div>
          {query && (
            <ClearFiltersButton
              className="self-start sm:self-center"
              onClick={() => {
                setQuery("");
                setPage(1);
              }}
            />
          )}
        </div>
        {selectable.length > 0 && (
          <RydSelectionBar
            total={selectable.length}
            scope="All contactable people matching this search, across pages"
            selectedCount={selectedSubmitters.length}
            disabled={busy}
            onToggleAll={() =>
              setSelected(
                selectedSubmitters.length === selectable.length
                  ? new Set()
                  : new Set(selectable.map((s) => s.key)),
              )
            }
          >
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              leftIcon={<FiMail aria-hidden />}
              disabled={busy || !selectedSubmitters.length}
              onClick={() => setEmailing("selected")}
            >
              Email selected
            </Button>
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              leftIcon={<FiCheckSquare aria-hidden />}
              disabled={busy || !selectedSubmitters.length}
              loading={contacting}
              loadingText="Marking..."
              onClick={() =>
                markContacted(selectedSubmitters.map((s) => s.email))
              }
            >
              Mark contacted
            </Button>
          </RydSelectionBar>
        )}
        <PendingResults
          pending={searchPending}
          label="Loading submission results"
        >
          {sorted.length === 0 && (
            <EmptyState
              className="py-12"
              message={
                query.trim()
                  ? "No submissions match this search. Try another name, email, or answer."
                  : queue.sheet.status === "ok"
                    ? "Every form submission is paired with an order."
                    : "No form submissions to show."
              }
            />
          )}
          <RydUnmatchedView
            submitters={sorted.slice(from, to + 1)}
            footer={
              sorted.length > 0 ? (
                <Pagination
                  page={currentPage}
                  pageSize={pageSize}
                  totalCount={sorted.length}
                  itemLabel={sorted.length === 1 ? "person" : "people"}
                  disabled={searchPending}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              ) : undefined
            }
            dismissed={queue.dismissed}
            contacts={queue.contacts}
            layout={layout}
            orderOptions={orderOptions}
            linking={linking}
            busy={dismissing}
            contacting={contacting}
            onLink={link}
            onMarkContacted={(email) => markContacted([email])}
            selection={{ selected, onToggle: toggle, disabled: busy }}
            onRemove={setRemoving}
            onRestore={(submission) => setDismissed(submission, true)}
          />
        </PendingResults>
      </section>

      <ConfirmationDialog
        open={removing !== null}
        setOpen={(open) => {
          if (!open && dismissing === null) setRemoving(null);
        }}
        title="Remove this response?"
        description={
          removing
            ? `The response from ${removing.legalName || removing.email}${removing.submittedAt ? `, sent ${removing.submittedAt},` : ""} stops showing here and in match suggestions. It stays in the Google Form, and you can restore it from Removed responses.`
            : undefined
        }
        confirmLabel="Remove"
        pendingLabel="Removing"
        pending={dismissing !== null}
        destructive
        onConfirm={() => removing && setDismissed(removing)}
      />
      {(recording || emailing) && (
        <RydContactDialog
          emails={
            recording ??
            (emailing === "selected" ? selectedSubmitters : contactable).map(
              (submitter) => submitter.email,
            )
          }
          draft={!recording}
          title={
            recording
              ? "Record contact"
              : emailing === "selected"
                ? `Email ${selectedSubmitters.length} selected`
                : "Email unmatched submitters"
          }
          onClose={() => {
            setRecording(null);
            setEmailing(null);
          }}
          onRecorded={contactsRecorded}
          onChanged={refresh}
        />
      )}
    </>
  );
}
