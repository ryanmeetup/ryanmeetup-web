"use client";

import { useState } from "react";
import { Button, Modal, ModalActions, Pill } from "@ryanmeetup/ui";
import { FiEdit3, FiMail } from "react-icons/fi";
import { CopyButton } from "@/components/global";
import { rydBlankEmailGroups } from "@/lib/ryd/bulk-operations";
import { rydMailtoHref } from "@/lib/ryd/emails";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";

/**
 * A blank email to every selected buyer, whatever their order's status. It
 * only opens the reviewer's mail app; nothing is recorded as contacted.
 */
export function RydBlankEmailDialog({
  orders,
  onClose,
}: {
  orders: RydQueueOrder[];
  onClose: () => void;
}) {
  // Pin recipients to the selection the dialog opened with.
  const [groups] = useState(() => rydBlankEmailGroups(orders));
  const [selectedCount] = useState(orders.length);
  const people = groups.reduce((total, group) => total + group.length, 0);
  const left = selectedCount - people;

  return (
    <Modal
      open
      setIsOpen={(open) => !open && onClose()}
      size="lg"
      title={`Email ${people} ${people === 1 ? "buyer" : "buyers"}`}
      description={
        groups.length > 1
          ? "Opens a blank email in your mail app with buyers in Bcc, so they can't see each other's addresses. Large selections are split so each email opens; send each one. Nothing is recorded here."
          : "Opens a blank email in your mail app with buyers in Bcc, so they can't see each other's addresses. Nothing is recorded here."
      }
      actions={<ModalActions confirmLabel="Close" onConfirm={onClose} />}
    >
      {!groups.length ? (
        <p className="text-sm text-black/70 dark:text-white/70">
          None of the selected orders has an email address that can be used.
        </p>
      ) : (
        <ul className="space-y-4">
          {groups.map((addresses, index) => {
            const mail =
              addresses.length === 1 ? { to: addresses } : { bcc: addresses };
            const label =
              groups.length > 1
                ? `Email ${index + 1} of ${groups.length}`
                : "Email";
            return (
              <li key={addresses[0]}>
                <section
                  aria-label={label}
                  className="space-y-3 rounded-2xl border border-black/10 p-4 dark:border-white/10"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{label}</p>
                    <Pill variant="neutral" size="sm">
                      {addresses.length}{" "}
                      {addresses.length === 1 ? "buyer" : "buyers"}
                    </Pill>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button.Link
                      href={rydMailtoHref(mail)}
                      size="xs"
                      className="w-full sm:w-auto"
                      leftIcon={<FiMail aria-hidden />}
                      prefetch={false}
                      newTab
                    >
                      Open email
                    </Button.Link>
                    <CopyButton value={addresses.join(", ")} label="Addresses">
                      Copy addresses
                    </CopyButton>
                  </div>
                </section>
              </li>
            );
          })}
        </ul>
      )}
      {groups.length > 0 && (
        <p className="mt-4 text-xs text-black/70 dark:text-white/70">
          Email didn&apos;t open? Copy the addresses into the Bcc field of your
          mail app.
          {left > 0 &&
            ` ${left} selected order${left === 1 ? " shares" : "s share"} an address with another or ${left === 1 ? "has" : "have"} no usable email.`}
        </p>
      )}
    </Modal>
  );
}

/** Opens a blank email to everyone selected, whatever their status. */
export function RydBlankEmailButton({
  selectedCount,
  disabled,
  onClick,
}: {
  selectedCount: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="w-full sm:w-auto"
      leftIcon={<FiEdit3 aria-hidden />}
      disabled={disabled || !selectedCount}
      title="A blank email to every selected buyer, whatever their status."
      onClick={onClick}
    >
      Blank email{selectedCount ? ` (${selectedCount})` : ""}
    </Button>
  );
}
