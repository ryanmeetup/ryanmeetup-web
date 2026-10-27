"use client";

import { useState, type ReactNode } from "react";
import { Button, Modal, ModalActions, Pill } from "@ryanmeetup/ui";
import { FiMail, FiX } from "react-icons/fi";
import { CopyButton } from "@/components/global";
import { rydCancellationGroups } from "@/lib/ryd/cancellations";
import {
  rydCancellationRequestEmail,
  rydMailtoHref,
  type RydDraft,
} from "@/lib/ryd/emails";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";

/** One draft: its recipients, the email, and the ways to get it sent. */
function DraftCard({
  title,
  badge,
  recipients,
  mail,
  draft,
  children,
}: {
  title: string;
  badge?: string;
  recipients: string[];
  mail: { to?: string[]; bcc?: string[] };
  draft: RydDraft;
  children?: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="space-y-4 rounded-2xl border border-black/10 p-4 dark:border-white/10"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {badge && (
          <Pill variant="neutral" size="sm">
            {badge}
          </Pill>
        )}
      </div>
      {children}
      <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
        <p className="font-semibold">{draft.subject}</p>
        <p className="mt-2 whitespace-pre-line break-words text-black/70 dark:text-white/70">
          {draft.body}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button.Link
          href={rydMailtoHref({ ...mail, ...draft })}
          size="xs"
          variant="secondary"
          leftIcon={<FiMail aria-hidden />}
          prefetch={false}
          newTab
        >
          Open draft
        </Button.Link>
        {recipients.length > 0 && (
          <CopyButton value={recipients.join(", ")} label="Addresses">
            Copy addresses
          </CopyButton>
        )}
        <CopyButton
          value={`Subject: ${draft.subject}\n\n${draft.body}`}
          label="Email"
        >
          Copy email
        </CopyButton>
      </div>
    </section>
  );
}

/**
 * Cancel orders that won't be made: ask fulfillment to cancel and refund
 * them, tell each buyer why, then mark the orders cancelled. Opening a draft
 * records nothing; only the final button changes the orders.
 */
export function RydCancelDialog({
  orders,
  fulfillmentEmail,
  onConfirm,
  onClose,
}: {
  orders: RydQueueOrder[];
  fulfillmentEmail: string | null;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  // Pinned when the dialog opens, so a reload never rewrites a draft that may
  // already be sent.
  const [request] = useState(() => rydCancellationRequestEmail(orders));
  const [{ groups, unreachable }] = useState(() =>
    rydCancellationGroups(orders),
  );
  const [count] = useState(orders.length);
  const [pending, setPending] = useState(false);
  const plural = count === 1 ? "order" : "orders";

  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open
      setIsOpen={(open) => !open && !pending && onClose()}
      size="lg"
      title={`Cancel ${count} ${plural}`}
      description="Send fulfillment the cancellation, email the buyers once the refunds have gone through, then mark the orders cancelled. Opening a draft records nothing."
      closable={!pending}
      actions={
        <ModalActions
          cancelLabel="Close"
          onCancel={onClose}
          confirmLabel={`Mark ${count} ${plural} cancelled`}
          confirmIcon={<FiX aria-hidden />}
          onConfirm={confirm}
          destructive
          pending={pending}
          pendingLabel="Cancelling..."
        />
      }
    >
      <ol className="space-y-4">
        <li>
          <DraftCard
            title="1. Ask fulfillment to cancel and refund"
            badge={`${count} ${plural}`}
            recipients={fulfillmentEmail ? [fulfillmentEmail] : []}
            mail={{ to: fulfillmentEmail ? [fulfillmentEmail] : [] }}
            draft={request}
          >
            {fulfillmentEmail ? (
              <p className="text-sm text-black/70 dark:text-white/70">
                To {fulfillmentEmail}
              </p>
            ) : (
              <p className="text-sm text-black/70 dark:text-white/70">
                No fulfillment email is saved, so the draft opens without a
                recipient. Add one in Settings.
              </p>
            )}
          </DraftCard>
        </li>
        {groups.map((group, index) => (
          <li key={group.key}>
            <DraftCard
              title={`${index + 2}. Tell the buyers: ${group.label.toLowerCase()}`}
              badge={`${group.addresses.length} ${group.addresses.length === 1 ? "buyer" : "buyers"}`}
              recipients={group.addresses}
              mail={
                group.addresses.length === 1
                  ? { to: group.addresses }
                  : { bcc: group.addresses }
              }
              draft={group.draft}
            />
          </li>
        ))}
      </ol>
      {unreachable > 0 && (
        <p className="mt-4 text-sm text-black/70 dark:text-white/70">
          {unreachable} {unreachable === 1 ? "order has" : "orders have"} no
          usable email, so{" "}
          {unreachable === 1 ? "that buyer needs" : "those buyers need"} to be
          told another way.
        </p>
      )}
      <p className="mt-4 text-xs text-black/70 dark:text-white/70">
        Draft didn&apos;t open? Copy the addresses and email into your mail app;
        buyer drafts use Bcc so nobody sees anyone else&apos;s address.
      </p>
    </Modal>
  );
}
