"use client";

import type { ReactNode } from "react";
import { CopyText, DisclosureCard, Textarea } from "@ryanmeetup/ui";
import type { IconType } from "react-icons";
import {
  FiCalendar,
  FiCreditCard,
  FiFileText,
  FiHash,
  FiMail,
  FiPackage,
  FiSend,
} from "react-icons/fi";
import type { RydCard } from "@/lib/ryd/card";
import { formatRydOrderTotal } from "@/lib/ryd/orders";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import { RydCardFields } from "./RydCardFields";
import { rydProductionSummary } from "./RydStatusChip";

function ReviewSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <DisclosureCard
      defaultOpen={defaultOpen}
      className="pb-4 last:pb-0"
      buttonClassName="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:text-white/70 dark:focus-visible:ring-white/40"
      panelClassName="pt-3"
      iconClassName="h-3.5 w-3.5 motion-reduce:transition-none"
      summary={
        <span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]">
          <span className="shrink-0">{title}</span>
          <span aria-hidden className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        </span>
      }
    >
      {children}
    </DisclosureCard>
  );
}

/** A fact about the order: the icon leads, the label is for screen readers. */
function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: IconType;
  label: string;
  children: ReactNode;
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

export function RydOrderSidebar({
  order,
  card,
  note,
  busy,
  locked,
  onCardChange,
  onNoteChange,
}: {
  order: RydQueueOrder;
  card: RydCard;
  note: string;
  busy: boolean;
  locked: boolean;
  onCardChange: (card: RydCard) => void;
  onNoteChange: (note: string) => void;
}) {
  return (
    <section
      aria-label="Order details"
      tabIndex={0}
      className="min-h-0 min-w-0 space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:focus-visible:ring-white/40 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-black/10 lg:py-6 lg:pr-4 lg:[scrollbar-gutter:stable] lg:dark:border-white/10"
    >
      <ReviewSection title="Order">
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
      </ReviewSection>
      {order.status !== "rejected" && (
        <ReviewSection title="Card">
          <RydCardFields
            card={card}
            hint={order.cardHint}
            saved={order.cardSaved}
            disabled={busy}
            locked={locked}
            onChange={onCardChange}
          />
        </ReviewSection>
      )}
      <ReviewSection title="Notes" defaultOpen={Boolean(order.note?.trim())}>
        <Textarea
          id="ryd-order-note"
          name="note"
          label="Note"
          rows={4}
          maxLength={2000}
          value={note}
          disabled={busy}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="What did you check? e.g. gift for her son Ryan."
        />
      </ReviewSection>
    </section>
  );
}
