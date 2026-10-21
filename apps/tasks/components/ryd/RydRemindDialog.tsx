"use client";

import { useState } from "react";
import {
  Button,
  ErrorCallout,
  Modal,
  ModalActions,
  Pill,
  toast,
} from "@ryanmeetup/ui";
import { FiCheck, FiMail } from "react-icons/fi";
import { CopyButton } from "@/components/global";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import { rydMailtoHref } from "@/lib/ryd/emails";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import { rydReminderGroups, type RydReminderResult } from "@/lib/ryd/reminders";

/** A draft is confirmed separately; opening or closing it never records a send. */
export function RydRemindDialog({
  orders,
  title = "Email buyers",
  onClose,
  onChanged,
}: {
  orders: RydQueueOrder[];
  title?: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [groups] = useState(() =>
    rydReminderGroups(orders).map((group) => ({
      ...group,
      operationId: crypto.randomUUID(),
    })),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState("");

  async function confirm(group: (typeof groups)[number]) {
    setPending(group.key);
    setError("");
    try {
      const result = await mutate<RydReminderResult>("/api/ryd/reminders", {
        method: "POST",
        body: JSON.stringify({
          operationId: group.operationId,
          targets: group.targets,
        }),
      });
      setCompleted((current) => new Set([...current, group.key]));
      toast.success(
        `Recorded email for ${result.markedCount} order${result.markedCount === 1 ? "" : "s"}.` +
          (result.skippedCount
            ? ` ${result.skippedCount} no longer waiting on the buyer were left alone.`
            : ""),
      );
      try {
        await onChanged();
      } catch {
        toast.error(
          "The email was recorded, but the queue could not reload. Refresh the page to see it.",
        );
      }
    } catch (failure) {
      setError(
        errorMessage(failure, "That draft couldn't be recorded. Try again."),
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <Modal
      open
      setIsOpen={(open) => !open && pending === null && onClose()}
      size="lg"
      title={title}
      description="Open a draft, send it from your own mail app, then mark only that draft as emailed. Opening or closing a draft records nothing. Group drafts use Bcc so buyers cannot see each other's addresses."
      closable={pending === null}
      actions={
        <ModalActions
          confirmLabel="Close"
          onConfirm={onClose}
          confirmDisabled={pending !== null}
        />
      }
    >
      <ErrorCallout>{error}</ErrorCallout>
      {!groups.length && (
        <p className="text-sm text-black/70 dark:text-white/70">
          No buyers in this selection can be emailed.
        </p>
      )}
      <ul className="space-y-4">
        {groups.map((group, index) => {
          const done = completed.has(group.key);
          const mail =
            group.addresses.length === 1
              ? { to: group.addresses }
              : { bcc: group.addresses };
          return (
            <li key={group.key}>
              <section
                aria-label={`Draft ${index + 1}: ${group.label}`}
                className="space-y-4 rounded-2xl border border-black/10 p-4 dark:border-white/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">
                    Draft {index + 1}: {group.label}
                  </p>
                  <Pill variant="neutral" size="sm">
                    {group.addresses.length}{" "}
                    {group.addresses.length === 1 ? "buyer" : "buyers"} ·{" "}
                    {group.targets.length}{" "}
                    {group.targets.length === 1 ? "order" : "orders"}
                  </Pill>
                  {done && (
                    <Pill variant="neutral" className="gap-2" size="sm">
                      <FiCheck aria-hidden /> Recorded
                    </Pill>
                  )}
                </div>
                <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="font-semibold">{group.draft.subject}</p>
                  <p className="mt-2 whitespace-pre-line break-words text-black/70 dark:text-white/70">
                    {group.draft.body}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button.Link
                    href={rydMailtoHref({ ...mail, ...group.draft })}
                    size="xs"
                    variant="secondary"
                    leftIcon={<FiMail aria-hidden />}
                    prefetch={false}
                    newTab
                    disabled={pending !== null || done}
                  >
                    Open draft
                  </Button.Link>
                  <CopyButton
                    value={group.addresses.join(", ")}
                    label="Addresses"
                  >
                    Copy addresses
                  </CopyButton>
                  <CopyButton
                    value={`Subject: ${group.draft.subject}\n\n${group.draft.body}`}
                    label="Email"
                  >
                    Copy email
                  </CopyButton>
                </div>
                <p className="text-xs text-black/70 dark:text-white/70">
                  Draft didn&apos;t open? Copy the addresses and email into your
                  mail app; use Bcc for a group.
                </p>
                <Button
                  size="xs"
                  className="w-full sm:w-auto"
                  leftIcon={<FiCheck aria-hidden />}
                  aria-label={`Mark draft ${index + 1} as emailed`}
                  disabled={done || pending !== null}
                  loading={pending === group.key}
                  loadingText="Recording..."
                  onClick={() => confirm(group)}
                >
                  {done ? "Email recorded" : "Mark this draft as emailed"}
                </Button>
              </section>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
