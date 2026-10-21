"use client";

import { useRef, useState } from "react";
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
import {
  RYD_MAILTO_LIMIT,
  rydContactGroups,
  type RydContactResult,
} from "@/lib/ryd/bulk-operations";
import { rydMailtoHref, rydUnmatchedEmail } from "@/lib/ryd/emails";

export function RydContactDialog({
  emails,
  draft,
  title,
  onClose,
  onRecorded,
  onChanged,
}: {
  emails: string[];
  draft: boolean;
  title: string;
  onClose: () => void;
  onRecorded: (result: RydContactResult) => void;
  onChanged: () => Promise<void>;
}) {
  const [groups] = useState(() =>
    rydContactGroups(emails, draft).map((addresses, index) => ({
      operationId: crypto.randomUUID(),
      emails: addresses,
      index,
    })),
  );
  const [pending, setPending] = useState<number | null>(null);
  const active = useRef(false);
  const [completed, setCompleted] = useState<ReadonlySet<number>>(new Set());
  const [errors, setErrors] = useState<Record<number, string>>({});
  const message = rydUnmatchedEmail();
  const count = groups.reduce((total, group) => total + group.emails.length, 0);
  const saved = groups
    .filter((group) => completed.has(group.index))
    .reduce((total, group) => total + group.emails.length, 0);

  async function confirm(group: (typeof groups)[number]) {
    if (active.current || completed.has(group.index)) return;
    active.current = true;
    setPending(group.index);
    setErrors((current) => ({ ...current, [group.index]: "" }));
    try {
      const result = await mutate<RydContactResult>(
        "/api/ryd/submitter-contacts",
        {
          method: "POST",
          body: JSON.stringify({
            operationId: group.operationId,
            emails: group.emails,
          }),
        },
      );
      setCompleted((current) => new Set([...current, group.index]));
      onRecorded(result);
      toast.success(
        `Recorded contact for ${result.markedCount} ${result.markedCount === 1 ? "person" : "people"}.`,
      );
      try {
        await onChanged();
      } catch {
        toast.error(
          "The contacts were recorded, but the queue could not reload. Do not record them again.",
        );
      }
    } catch (failure) {
      setErrors((current) => ({
        ...current,
        [group.index]: errorMessage(
          failure,
          "This group could not be confirmed. Retry the same group.",
        ),
      }));
    } finally {
      active.current = false;
      setPending(null);
    }
  }

  return (
    <Modal
      open
      title={title}
      size="lg"
      description={
        draft
          ? "Send each draft from your mail app using Bcc, then confirm only that draft. Opening or closing a draft records nothing."
          : "Record contact you already made. Each group is one attempt per person; confirm only the groups you contacted."
      }
      setIsOpen={(open) => !open && pending === null && onClose()}
      closable={pending === null}
      actions={
        <ModalActions
          confirmLabel="Close"
          onConfirm={onClose}
          confirmDisabled={pending !== null}
        />
      }
    >
      <p
        role="status"
        className="mb-4 text-sm text-black/70 dark:text-white/70"
      >
        {saved} of {count} selected people recorded · {groups.length}{" "}
        {draft ? "drafts" : "groups"}
      </p>
      <ul className="space-y-4">
        {groups.map((group) => {
          const done = completed.has(group.index);
          const label = `${draft ? "Draft" : "Group"} ${group.index + 1}`;
          return (
            <li key={group.operationId}>
              <section
                aria-label={label}
                className="space-y-4 rounded-2xl border border-black/10 p-4 dark:border-white/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">
                    {label}: No matching order
                  </p>
                  <Pill variant="neutral" size="sm">
                    {group.emails.length} people
                  </Pill>
                  {done && (
                    <Pill variant="neutral" size="sm">
                      <FiCheck aria-hidden /> Recorded
                    </Pill>
                  )}
                </div>
                <div
                  aria-label={`Addresses in ${label.toLowerCase()}`}
                  role="region"
                  tabIndex={0}
                  className="max-h-24 overflow-y-auto break-all rounded-xl bg-black/[0.03] p-3 text-xs text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:bg-white/[0.04] dark:text-white/70 dark:focus-visible:ring-white/40"
                >
                  {group.emails.join(", ")}
                </div>
                {draft && (
                  <>
                    <div className="rounded-xl border border-black/10 p-3 text-sm dark:border-white/10">
                      <p className="font-semibold">{message.subject}</p>
                      <p className="mt-2 whitespace-pre-line break-words text-black/70 dark:text-white/70">
                        {message.body}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button.Link
                        href={rydMailtoHref({ bcc: group.emails, ...message })}
                        size="xs"
                        variant="secondary"
                        leftIcon={<FiMail aria-hidden />}
                        prefetch={false}
                        newTab
                        disabled={
                          pending !== null ||
                          done ||
                          rydMailtoHref({ bcc: group.emails, ...message })
                            .length > RYD_MAILTO_LIMIT
                        }
                      >
                        Open draft
                      </Button.Link>
                      <CopyButton
                        value={group.emails.join(", ")}
                        label="Addresses"
                      >
                        Copy addresses
                      </CopyButton>
                      <CopyButton
                        value={`Subject: ${message.subject}\n\n${message.body}`}
                        label="Email"
                      >
                        Copy email
                      </CopyButton>
                    </div>
                    <p className="text-xs text-black/70 dark:text-white/70">
                      Draft didn&apos;t open? Copy the addresses and email into
                      your mail app; use Bcc for a group.
                    </p>
                  </>
                )}
                <ErrorCallout>{errors[group.index]}</ErrorCallout>
                {errors[group.index] && (
                  <p className="text-xs text-black/70 dark:text-white/70">
                    The group may already be saved. Retry uses the same
                    confirmation and cannot add another attempt.
                  </p>
                )}
                <Button
                  size="xs"
                  className="w-full sm:w-auto"
                  leftIcon={<FiCheck aria-hidden />}
                  aria-label={`Mark ${label.toLowerCase()} as contacted`}
                  disabled={done || pending !== null}
                  loading={pending === group.index}
                  loadingText="Recording..."
                  onClick={() => confirm(group)}
                >
                  {done
                    ? "Contact recorded"
                    : errors[group.index]
                      ? "Retry this group"
                      : `Mark this ${draft ? "draft" : "group"} as contacted`}
                </Button>
              </section>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
