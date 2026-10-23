"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Button,
  ConfirmationDialog,
  ErrorCallout,
  Modal,
  ModalActions,
  Spinner,
  toast,
} from "@ryanmeetup/ui";
import { FiCheck, FiDownload, FiMail } from "react-icons/fi";
import { CopyButton } from "@/components/global";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import { rydMailtoHref } from "@/lib/ryd/emails";
import type {
  RydFulfillmentResult,
  RydFulfillmentSnapshot,
} from "@/lib/ryd/fulfillment";

import { RydSheetReport } from "./RydSheetReport";

const prepareBatch = (orderIds: string[] | null, replaceSnapshotId?: string) =>
  mutate<RydFulfillmentSnapshot>("/api/ryd/batches", {
    method: "POST",
    body: JSON.stringify({
      action: "prepare",
      ...(orderIds ? { orderIds } : {}),
      ...(replaceSnapshotId ? { replaceSnapshotId } : {}),
    }),
  });

export function RydSendDialog({
  orderIds,
  onClose,
  onChanged,
  onPrepared,
  onFinished,
}: {
  orderIds: string[] | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onPrepared: (snapshot: RydFulfillmentSnapshot) => void;
  onFinished: (
    result: RydFulfillmentResult,
    action: "confirm" | "cancel",
  ) => void;
}) {
  const [snapshot, setSnapshot] = useState<RydFulfillmentSnapshot | null>(null);
  const [completed, setCompleted] = useState<RydFulfillmentResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const completionRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (completed) completionRef.current?.focus({ preventScroll: true });
  }, [completed]);

  useEffect(() => {
    let active = true;
    prepareBatch(orderIds)
      .then((result) => {
        if (active) {
          setSnapshot(result);
          onPrepared(result);
          setError("");
        }
      })
      .catch((failure) => {
        if (active)
          setError(errorMessage(failure, "The batch could not be prepared."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, onPrepared, orderIds]);

  async function replaceBatch() {
    if (!snapshot || !orderIds || sending) return;
    setSending(true);
    try {
      const result = await prepareBatch(orderIds, snapshot.id);
      setSnapshot(result);
      onPrepared(result);
      setError("");
    } catch (failure) {
      setError(
        errorMessage(failure, "The selected batch could not be generated."),
      );
    } finally {
      setSending(false);
      setReplaceOpen(false);
    }
  }

  async function finish(action: "confirm" | "cancel") {
    if (!snapshot || sending || completed) return;
    setSending(true);
    try {
      const result = await mutate<RydFulfillmentResult>("/api/ryd/batches", {
        method: "POST",
        body: JSON.stringify({ action, snapshotId: snapshot.id }),
      });
      setError("");
      if (action === "confirm") setCompleted(result);
      onFinished(result, action);
      toast.success(
        action === "cancel"
          ? "Batch cancelled. Its ready orders are available for a new batch."
          : `Email ${result.changed ? "recorded" : "already recorded"}: ${result.verifiedCount} ${result.verifiedCount === 1 ? "order" : "orders"} sent to fulfillment, awaiting production confirmation.`,
      );
      // Once the transaction succeeds, a reload failure must not invite a
      // second send. Retrying confirmation is also safe after a lost response.
      try {
        await onChanged();
      } catch {
        toast.error(
          "The batch saved, but the queue could not reload. Refresh the page to see it.",
        );
      }
      if (action === "cancel") onClose();
    } catch (failure) {
      setError(errorMessage(failure, "The batch could not be updated."));
      setCancelOpen(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Modal
        open
        setIsOpen={(open) => !open && !sending && onClose()}
        size="lg"
        title={completed ? "Sent to fulfillment" : "Prepare fulfillment batch"}
        description={
          completed
            ? "The email is recorded. Production starts only after fulfillment confirms it."
            : snapshot?.selectionConflict
              ? "Review the saved draft before generating the email and CSV for your selected orders."
              : "Download the CSV, attach it to the draft, and send it from your email app. Then confirm the email was sent. Closing keeps this batch available to the team."
        }
        closable={!sending}
        actions={
          completed ? (
            <Button
              onClick={onClose}
              disabled={sending}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          ) : (
            <ModalActions
              confirmLabel="Confirm email sent"
              confirmIcon={<FiCheck aria-hidden />}
              onConfirm={() => finish("confirm")}
              confirmDisabled={
                !snapshot ||
                loading ||
                snapshot.requiresRebuild ||
                snapshot.selectionConflict
              }
              cancelLabel="Close"
              onCancel={onClose}
              pending={sending}
              pendingLabel="Saving..."
            />
          )
        }
      >
        {loading && (
          <div className="flex items-center gap-3" role="status">
            <Spinner aria-hidden />{" "}
            {orderIds
              ? "Generating the selected batch…"
              : "Resuming the saved batch…"}
          </div>
        )}
        <ErrorCallout>{error}</ErrorCallout>
        {!snapshot && !loading && (
          <Button
            variant="secondary"
            className="mt-4 w-full sm:w-auto"
            onClick={() => {
              setLoading(true);
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        )}
        {completed && (
          <div className="space-y-6">
            <p role="status" ref={completionRef} tabIndex={-1}>
              Email recorded for {completed.verifiedCount}{" "}
              {completed.verifiedCount === 1 ? "order" : "orders"}. They are now
              Sent to fulfillment, awaiting production confirmation.
            </p>
            <RydSheetReport report={completed.sheet} />
          </div>
        )}
        {snapshot && !completed && (
          <div aria-busy={sending} className="space-y-6">
            {snapshot.selectionConflict && orderIds ? (
              <div className="space-y-4 rounded-2xl border border-black/10 p-4 dark:border-white/10">
                <p>
                  You selected{" "}
                  <strong>
                    {orderIds.length} ready{" "}
                    {orderIds.length === 1 ? "order" : "orders"}
                  </strong>
                  . A different draft with {snapshot.orderCount} orders is still
                  saved. Replace that unsent draft to generate the email and CSV
                  for your selection.
                </p>
                <Button
                  className="w-full sm:w-auto"
                  disabled={sending}
                  onClick={() => setReplaceOpen(true)}
                >
                  Generate selected batch instead
                </Button>
              </div>
            ) : (
              snapshot.requiresRebuild && (
                <ErrorCallout>
                  This saved batch includes orders still being checked or
                  already sent for production. If nobody has emailed it, cancel
                  this batch, then prepare a new batch with only the new
                  verified orders.
                </ErrorCallout>
              )
            )}
            {!snapshot.selectionConflict && (
              <>
                <dl className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-black/70 dark:text-white/70">
                    Orders in this batch
                  </dt>
                  <dd className="mt-1 font-cooper text-3xl">
                    {snapshot.orderCount}
                  </dd>
                </dl>
                <p className="text-sm text-black/70 dark:text-white/70">
                  Prepared {new Date(snapshot.preparedAt).toLocaleString()}.
                  Ready orders and their evidence stay reserved until this batch
                  is marked sent or cancelled. New orders and later
                  verifications go in the next file.
                </p>
                {!snapshot.requiresRebuild && (
                  <ol className="space-y-4">
                    <RydDraftStep
                      index={1}
                      title="Download the file"
                      description="The exact orders and decisions saved when this batch was prepared."
                    >
                      <Button.Link
                        href={`/api/ryd/export?batch=${snapshot.id}`}
                        size="xs"
                        variant="secondary"
                        leftIcon={<FiDownload aria-hidden />}
                        prefetch={false}
                        download
                        disabled={sending}
                      >
                        Download CSV
                      </Button.Link>
                    </RydDraftStep>
                    <RydDraftStep
                      index={2}
                      title="Email it to fulfillment"
                      description={
                        <>
                          Opens a draft to{" "}
                          <span className="font-semibold break-all">
                            {snapshot.recipient}
                          </span>{" "}
                          listing the {snapshot.verifiedCount} ready order
                          {snapshot.verifiedCount === 1 ? "" : "s"}. Attach this
                          batch&apos;s file, then send.
                        </>
                      }
                    >
                      <Button.Link
                        href={rydMailtoHref({
                          to: [snapshot.recipient],
                          ...snapshot.draft,
                        })}
                        size="xs"
                        variant="secondary"
                        leftIcon={<FiMail aria-hidden />}
                        prefetch={false}
                        newTab
                        disabled={sending}
                      >
                        Open draft
                      </Button.Link>
                      <CopyButton
                        value={`Subject: ${snapshot.draft.subject}\n\n${snapshot.draft.body}`}
                        label="Email"
                      >
                        Copy email
                      </CopyButton>
                    </RydDraftStep>
                    <RydDraftStep
                      index={3}
                      title="Confirm the email was sent"
                      description="Moves this batch to Sent to fulfillment and keeps it out of future files. Confirm production started separately when fulfillment acknowledges it."
                    />
                  </ol>
                )}
                <Button
                  variant="secondary"
                  size="xs"
                  className="w-full sm:w-auto"
                  disabled={sending}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel this batch
                </Button>
              </>
            )}
          </div>
        )}
      </Modal>
      <ConfirmationDialog
        open={replaceOpen}
        setOpen={(open) => !sending && setReplaceOpen(open)}
        title={`Replace the saved draft with ${orderIds?.length ?? 0} selected ${orderIds?.length === 1 ? "order" : "orders"}?`}
        description={`Only replace if nobody has emailed the previous ${snapshot?.orderCount ?? 0}-order file. Discard that file and draft. This generates a new email and CSV containing exactly your selection.`}
        confirmLabel="Replace draft & generate"
        pendingLabel="Generating..."
        pending={sending}
        onConfirm={replaceBatch}
      />
      <ConfirmationDialog
        open={cancelOpen}
        setOpen={(open) => !sending && setCancelOpen(open)}
        title="Cancel this fulfillment batch?"
        description="Only cancel if nobody has emailed this file. Coordinate with anyone using this batch first. Cancellation releases its ready orders; discard this file and draft before preparing another."
        confirmLabel="Cancel batch"
        pendingLabel="Cancelling..."
        pending={sending}
        destructive
        onConfirm={() => finish("cancel")}
      />
    </>
  );
}

/** One numbered step of a manual send, with its actions beside it. */
function RydDraftStep({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 border-t border-black/10 pt-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/10">
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {index}. {title}
        </p>
        {description && (
          <p className="mt-1 text-sm text-black/70 dark:text-white/70">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
      )}
    </li>
  );
}
