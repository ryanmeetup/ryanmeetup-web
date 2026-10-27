"use client";

import { useMemo, useState } from "react";
import {
  Button,
  CopyText,
  DropdownSelect,
  Modal,
  Textarea,
  toast,
} from "@ryanmeetup/ui";
import type { IconType } from "react-icons";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiClock,
  FiCreditCard,
  FiFileText,
  FiHash,
  FiHelpCircle,
  FiInfo,
  FiLink,
  FiMail,
  FiPackage,
  FiPaperclip,
  FiPlus,
  FiSave,
  FiSend,
  FiX,
} from "react-icons/fi";
import { errorMessage } from "@/lib/presentation";
import type { RydSubmission } from "@/lib/ryd/matching";
import { formatRydOrderTotal, type RydOrderStatus } from "@/lib/ryd/orders";
import type { RydQueueChange } from "@/lib/ryd/queue-reconciliation";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import { canEmailRydOrder, orderSubmissions } from "@/lib/ryd/queue-view";
import {
  changeRydLinks,
  decideRydOrder,
  saveRydNote,
  rydDecisionLocked,
} from "@/lib/ryd/ryd-decisions";
import {
  RydConfidenceChip,
  RydProductionChip,
  rydProductionSummary,
  RydStatusChip,
} from "./RydStatusChip";
import { rydReminderHasEvidence } from "@/lib/ryd/reminders";
import { RydCancelDialog } from "./RydCancelDialog";
import { RydRemindDialog } from "./RydRemindDialog";
import { RydSubmissionCard } from "./RydSubmissionCard";

/**
 * The ways an order can be decided. The dialog, and the bulk bar on the page,
 * offer every one except where the order already stands, so a decided order
 * shows only a change of mind.
 */
export const RYD_DECISIONS: {
  status: Exclude<RydOrderStatus, "pending">;
  label: string;
  icon: IconType;
}[] = [
  { status: "rejected", label: "Cancel order", icon: FiX },
  { status: "needs_info", label: "Needs more info", icon: FiHelpCircle },
  { status: "verified", label: "Verify", icon: FiCheck },
];

/** One fact about the order: the icon leads, the label is for screen readers. */
function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: IconType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <dt className="mt-0.5 shrink-0 text-black/55 dark:text-white/55">
        <Icon aria-hidden className="h-4 w-4" />
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

/** A reason the form suggested this pairing; caveats get a softer icon. */
function Reason({ reason }: { reason: string }) {
  const Icon =
    /match/i.test(reason) && !/differ/i.test(reason) ? FiCheck : FiInfo;
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-2.5 py-0.5 text-xs text-black/75 dark:border-white/10 dark:text-white/75">
      <Icon aria-hidden className="h-3 w-3 shrink-0" />
      {reason}
    </li>
  );
}

/**
 * Review one order: what fulfillment sent, what the buyer sent the form, and
 * a decision. Pairing and the decision are saved separately so a reviewer can
 * link the right submission, look, and then decide.
 */
export function RydOrderDialog({
  order,
  submissions,
  claimedKeys,
  fulfillmentEmail,
  onClose,
  onChanged,
  onApplied,
}: {
  order: RydQueueOrder;
  submissions: RydSubmission[];
  /** Linked to another order; one submission vouches for one Ryan. */
  claimedKeys: ReadonlySet<string>;
  /** Who the cancellation request is addressed to. */
  fulfillmentEmail: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onApplied: (change: RydQueueChange) => void;
}) {
  const [note, setNote] = useState(order.note ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [linkChoice, setLinkChoice] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const shown = orderSubmissions(order, submissions);

  const linkOptions = useMemo(
    () =>
      submissions
        .filter(
          (submission) =>
            !order.linkedKeys.includes(submission.key) &&
            !claimedKeys.has(submission.key),
        )
        .map((submission) => ({
          value: submission.key,
          label: submission.legalName || "No name given",
          details: [
            { icon: <FiMail aria-hidden />, text: submission.email },
            { icon: <FiClock aria-hidden />, text: submission.submittedAt },
            {
              icon: <FiPaperclip aria-hidden />,
              text: `${submission.fileIds.length} file${submission.fileIds.length === 1 ? "" : "s"}`,
            },
          ].filter((detail) => detail.text),
        })),
    [submissions, order.linkedKeys, claimedKeys],
  );

  async function run(
    label: string,
    action: () => Promise<RydQueueChange>,
    success: string,
  ) {
    setPending(label);
    try {
      const change = await action();
      onApplied(change);
      // Reload status belongs to the queue; this write is already confirmed.
      void onChanged().catch(() => {});
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "That didn't save. Try again."));
      return false;
    } finally {
      setPending(null);
    }
  }

  const link = (submissionKey: string, source: "suggested" | "manual") =>
    changeRydLinks(order.orderId, [submissionKey], true, source);

  async function decide(status: RydOrderStatus) {
    const saved = await run(
      status,
      () => decideRydOrder(order, submissions, status, note),
      status === "verified"
        ? `${order.firstName} ${order.lastName} is verified.`
        : status === "rejected"
          ? "Order cancelled."
          : "Decision saved.",
    );
    if (saved) onClose();
  }

  const noteChanged = note.trim() !== (order.note ?? "");

  async function saveNote() {
    if (await run("note", () => saveRydNote(order, note), "Note saved."))
      onClose();
  }

  const busy = pending !== null;
  // Fulfillment was told, or it's being made: the decision is settled. The
  // routes refuse a change; the buttons just don't offer one.
  const locked = rydDecisionLocked(order);
  const name =
    `${order.firstName} ${order.lastName}`.trim() || order.displayEmail;

  if (emailOpen)
    return (
      <RydRemindDialog
        orders={[order]}
        title={`Email ${order.firstName || "buyer"}`}
        onClose={() => setEmailOpen(false)}
        onChanged={onChanged}
      />
    );

  if (cancelOpen)
    return (
      <RydCancelDialog
        orders={[order]}
        fulfillmentEmail={fulfillmentEmail}
        onConfirm={() => decide("rejected")}
        onClose={() => setCancelOpen(false)}
      />
    );

  return (
    <Modal
      open
      setIsOpen={(open) => !open && !busy && onClose()}
      size="xl"
      closable={!busy}
      title={
        <span className="flex flex-wrap items-center gap-3">
          {name}
          <RydStatusChip status={order.status} />
          {order.status === "verified" && <RydProductionChip order={order} />}
        </span>
      }
      supportingActions={
        canEmailRydOrder(order) && (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<FiMail aria-hidden />}
            disabled={busy}
            onClick={() => setEmailOpen(true)}
          >
            {rydReminderHasEvidence(order) ? "Ask for more" : "Ask to verify"}
          </Button>
        )
      }
      actions={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          {!locked &&
            RYD_DECISIONS.filter(({ status }) => status !== order.status).map(
              ({ status, label, icon: Icon }) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={
                    status === "verified" && order.status === "pending"
                      ? "primary"
                      : "secondary"
                  }
                  leftIcon={<Icon aria-hidden />}
                  disabled={busy}
                  loading={pending === status}
                  onClick={() =>
                    status === "rejected" ? setCancelOpen(true) : decide(status)
                  }
                >
                  {label}
                </Button>
              ),
            )}
          {order.status !== "pending" && noteChanged && (
            <Button
              type="button"
              size="sm"
              leftIcon={<FiSave aria-hidden />}
              disabled={busy}
              loading={pending === "note"}
              onClick={saveNote}
            >
              Save note
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <section aria-labelledby="ryd-order-heading" className="space-y-5">
          <h3
            id="ryd-order-heading"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-black/70 dark:text-white/70"
          >
            Order
          </h3>
          <dl className="space-y-3">
            <Detail icon={FiHash} label="Order number">
              <CopyText value={order.orderId} label="order number">
                Order {order.orderId}
              </CopyText>
            </Detail>
            {order.salesOrder && (
              <Detail icon={FiFileText} label="Sales order number">
                <CopyText value={order.salesOrder} label="sales order number">
                  Sales order {order.salesOrder}
                </CopyText>
              </Detail>
            )}
            <Detail icon={FiMail} label="Email">
              <span className="break-all">{order.displayEmail}</span>
            </Detail>
            <Detail icon={FiCalendar} label="Ordered">
              {order.orderedAt || "Not given"}
            </Detail>
            {order.total && (
              <Detail icon={FiCreditCard} label="Total">
                {formatRydOrderTotal(order.total)}
              </Detail>
            )}
            {order.status === "verified" && (
              <Detail icon={FiPackage} label="Progress">
                {rydProductionSummary(order)}
              </Detail>
            )}
            {order.lastEmailedAt && (
              <Detail icon={FiSend} label="Last emailed">
                Emailed {new Date(order.lastEmailedAt).toLocaleString()}
              </Detail>
            )}
          </dl>
          <Textarea
            id="ryd-order-note"
            name="note"
            label="Note"
            rows={4}
            maxLength={2000}
            value={note}
            disabled={busy}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What did you check? e.g. gift for her son Ryan."
          />
        </section>

        <section
          aria-labelledby="ryd-submissions-heading"
          className="min-w-0 space-y-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h3
              id="ryd-submissions-heading"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-black/70 dark:text-white/70"
            >
              {shown.linked ? "Linked" : "From the form"}
            </h3>
            {!shown.linked && order.suggestion && (
              <RydConfidenceChip confidence={order.suggestion.confidence} />
            )}
          </div>

          {!shown.linked && order.suggestion && (
            <ul
              aria-label="Why it was suggested"
              className="flex flex-wrap gap-2"
            >
              {order.suggestion.reasons.map((reason) => (
                <Reason key={reason} reason={reason} />
              ))}
            </ul>
          )}
          {shown.missing > 0 && (
            <p className="flex items-center gap-2 text-sm text-black/70 dark:text-white/70">
              <FiAlertTriangle aria-hidden className="shrink-0" />
              {shown.missing === 1
                ? "A linked submission is no longer in the form."
                : `${shown.missing} linked submissions are no longer in the form.`}
            </p>
          )}

          {shown.submissions.length ? (
            <div className="space-y-3">
              {shown.submissions.map((submission) => (
                <RydSubmissionCard
                  key={submission.key}
                  submission={submission}
                  action={
                    shown.linked ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={busy}
                        loading={pending === `unlink:${submission.key}`}
                        onClick={() =>
                          run(
                            `unlink:${submission.key}`,
                            () =>
                              changeRydLinks(
                                order.orderId,
                                [submission.key],
                                false,
                              ),
                            "Unlinked.",
                          )
                        }
                      >
                        Unlink
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        leftIcon={<FiLink aria-hidden />}
                        disabled={busy}
                        // Verify links these too, so they load with it.
                        loading={
                          pending === `link:${submission.key}` ||
                          pending === "verified"
                        }
                        loadingText="Linking..."
                        onClick={() =>
                          run(
                            `link:${submission.key}`,
                            () => link(submission.key, "suggested"),
                            "Linked to this order.",
                          )
                        }
                      >
                        Link
                      </Button>
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-black/15 p-4 text-sm text-black/70 dark:border-white/15 dark:text-white/70">
              Nothing on the form matches {order.firstName || "this buyer"}.
              Ordered for someone else? Link their submission below.
            </p>
          )}

          {linkOptions.length > 0 &&
            (choosing || !shown.submissions.length ? (
              <div className="flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/10 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <DropdownSelect
                    variant="field"
                    label="Link another submission"
                    options={linkOptions}
                    value={linkChoice}
                    onChange={setLinkChoice}
                    searchPlaceholder="Search by name or email"
                    disabled={busy}
                  />
                </div>
                <Button
                  type="button"
                  size="field"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  leftIcon={<FiLink aria-hidden />}
                  disabled={busy || !linkChoice}
                  loading={pending === "manual"}
                  onClick={async () => {
                    if (
                      await run(
                        "manual",
                        () => link(linkChoice, "manual"),
                        "Linked to this order.",
                      )
                    ) {
                      setLinkChoice("");
                      setChoosing(false);
                    }
                  }}
                >
                  Link
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                leftIcon={<FiPlus aria-hidden />}
                disabled={busy}
                onClick={() => setChoosing(true)}
              >
                Link another submission
              </Button>
            ))}
        </section>
      </div>
    </Modal>
  );
}
