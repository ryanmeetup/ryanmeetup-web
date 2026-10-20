"use client";

import { useMemo, useState } from "react";
import { Button, DropdownSelect, Modal, Textarea, toast } from "@ryanmeetup/ui";
import {
  FiAlertTriangle,
  FiCheck,
  FiHelpCircle,
  FiLink,
  FiMail,
  FiX,
} from "react-icons/fi";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import type { RydSubmission } from "@/lib/ryd/matching";
import type { RydOrderStatus } from "@/lib/ryd/orders";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import { orderSubmissions } from "@/lib/ryd/queue-view";
import { RydConfidenceChip, RydStatusChip } from "./RydStatusChip";
import { RydSubmissionCard } from "./RydSubmissionCard";

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
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
  emailConfigured,
  onClose,
  onChanged,
}: {
  order: RydQueueOrder;
  submissions: RydSubmission[];
  emailConfigured: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [note, setNote] = useState(order.note ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [linkChoice, setLinkChoice] = useState("");
  const shown = orderSubmissions(order, submissions);

  const linkOptions = useMemo(
    () =>
      submissions
        .filter((submission) => !order.linkedKeys.includes(submission.key))
        .map((submission) => ({
          value: submission.key,
          label: `${submission.legalName || "No name"} · ${submission.email} · ${submission.submittedAt}`,
        })),
    [submissions, order.linkedKeys],
  );

  async function run(
    label: string,
    action: () => Promise<unknown>,
    success: string,
  ) {
    setPending(label);
    try {
      await action();
      await onChanged();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "That didn't save. Try again."));
      return false;
    } finally {
      setPending(null);
    }
  }

  const base = `/api/ryd/orders/${encodeURIComponent(order.orderId)}`;
  const link = (submissionKey: string, source: "suggested" | "manual") =>
    mutate(`${base}/links`, {
      method: "POST",
      body: JSON.stringify({ submissionKey, source }),
    });

  async function decide(status: RydOrderStatus) {
    const saved = await run(
      status,
      async () => {
        // Verifying from a suggestion accepts it: the pairing is what lets
        // the send step tick the right rows in the response sheet.
        if (status === "verified" && !shown.linked)
          for (const submission of shown.submissions)
            await link(submission.key, "suggested");
        await mutate(base, {
          method: "PATCH",
          body: JSON.stringify({ status, note }),
        });
      },
      status === "verified"
        ? `${order.firstName} ${order.lastName} is verified.`
        : "Decision saved.",
    );
    if (saved) onClose();
  }

  const busy = pending !== null;
  const name =
    `${order.firstName} ${order.lastName}`.trim() || order.displayEmail;

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
        </span>
      }
      description={`Order ${order.orderId}${order.salesOrder ? ` · sales order ${order.salesOrder}` : ""}`}
      supportingActions={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          leftIcon={<FiMail aria-hidden />}
          disabled={busy || !emailConfigured || !order.email}
          loading={pending === "email"}
          onClick={() =>
            run(
              "email",
              () => mutate(`${base}/email`, { method: "POST", body: "{}" }),
              `Emailed ${order.displayEmail}.`,
            )
          }
        >
          {shown.submissions.length ? "Ask for more" : "Ask to verify"}
        </Button>
      }
      actions={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<FiX aria-hidden />}
            disabled={busy}
            loading={pending === "rejected"}
            onClick={() => decide("rejected")}
          >
            Reject
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<FiHelpCircle aria-hidden />}
            disabled={busy}
            loading={pending === "needs_info"}
            onClick={() => decide("needs_info")}
          >
            Needs more info
          </Button>
          <Button
            type="button"
            size="sm"
            leftIcon={<FiCheck aria-hidden />}
            disabled={busy}
            loading={pending === "verified"}
            onClick={() => decide("verified")}
          >
            Verify
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <section aria-labelledby="ryd-order-heading" className="space-y-5">
          <h3
            id="ryd-order-heading"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-black/70 dark:text-white/70"
          >
            From fulfillment
          </h3>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Detail label="Bill to">{name}</Detail>
            <Detail label="Email">
              <span className="break-all">{order.displayEmail}</span>
            </Detail>
            <Detail label="Ordered">{order.orderedAt || "Not given"}</Detail>
            <Detail label="Prefers">
              {order.contactMethod || "Not given"}
            </Detail>
            {order.total && <Detail label="Total">${order.total}</Detail>}
            {order.lastEmailedAt && (
              <Detail label="Last emailed">
                {new Date(order.lastEmailedAt).toLocaleString()}
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
            onChange={(event) => setNote(event.target.value)}
            placeholder="What did you check? e.g. gift for a 14-year-old Ryan, mom confirmed."
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
              {shown.linked ? "Linked submissions" : "From the form"}
            </h3>
            {!shown.linked && order.suggestion && (
              <RydConfidenceChip confidence={order.suggestion.confidence} />
            )}
          </div>

          {!shown.linked && order.suggestion && (
            <p className="text-sm text-black/70 dark:text-white/70">
              Suggested because: {order.suggestion.reasons.join(" · ")}.
              Verifying links it to this order.
            </p>
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
                              mutate(`${base}/links`, {
                                method: "DELETE",
                                body: JSON.stringify({
                                  submissionKey: submission.key,
                                }),
                              }),
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
                        loading={pending === `link:${submission.key}`}
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
              Nothing on the form looks like {order.firstName || "this buyer"}.
              If they ordered for someone else, or used another email, link
              their submission below.
            </p>
          )}

          {linkOptions.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/10 2xl:flex-row 2xl:items-end">
              <div className="min-w-0 flex-1">
                <DropdownSelect
                  variant="field"
                  label="Link a different submission"
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
                  )
                    setLinkChoice("");
                }}
              >
                Link
              </Button>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
