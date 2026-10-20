"use client";

import { useState, type ReactNode } from "react";
import {
  Button,
  ErrorCallout,
  Input,
  Modal,
  ModalActions,
  Pill,
  toast,
} from "@ryanmeetup/ui";
import {
  FiCheck,
  FiDownload,
  FiLogOut,
  FiMail,
  FiUpload,
} from "react-icons/fi";
import { CopyButton } from "@/components/global";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import {
  rydBuyerEmail,
  rydFulfillmentEmail,
  rydMailtoHref,
  rydUnmatchedEmail,
  type RydDraft,
} from "@/lib/ryd/emails";
import type { RydSubmitter } from "@/lib/ryd/matching";
import type { RydQueue, RydQueueOrder } from "@/lib/ryd/queue-types";

const UPLOAD_FORM = "ryd-upload-form";
const SETTINGS_FORM = "ryd-settings-form";

type ImportResult = {
  rowCount: number;
  newCount: number;
  existingCount: number;
  duplicateCount: number;
  preverifiedCount: number;
};

function importSummary(result: ImportResult) {
  const parts = [
    `${result.newCount} new order${result.newCount === 1 ? "" : "s"} added`,
  ];
  if (result.existingCount)
    parts.push(`${result.existingCount} already in the queue`);
  if (result.preverifiedCount)
    parts.push(`${result.preverifiedCount} already ticked by fulfillment`);
  if (result.duplicateCount)
    parts.push(`${result.duplicateCount} repeated in the file`);
  return `${parts.join(", ")}.`;
}

export function RydUploadDialog({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      open
      setIsOpen={(open) => !open && !saving && onClose()}
      title="Upload orders"
      description="The order summary CSV fulfillment sends each week. Orders already in the queue keep their decisions; only new ones are added."
      closable={!saving}
      formId={UPLOAD_FORM}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!file) return;
        setSaving(true);
        setError(null);
        try {
          const body = new FormData();
          body.set("file", file);
          const result = await mutate<ImportResult>("/api/ryd/imports", {
            method: "POST",
            body,
          });
          await onChanged();
          toast.success(importSummary(result));
          onClose();
        } catch (failure) {
          setError(errorMessage(failure, "The file couldn't be imported."));
        } finally {
          setSaving(false);
        }
      }}
      actions={
        <ModalActions
          confirmForm={UPLOAD_FORM}
          confirmLabel="Upload"
          confirmIcon={<FiUpload aria-hidden />}
          confirmDisabled={!file}
          onCancel={onClose}
          pending={saving}
          pendingLabel="Uploading..."
        />
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold">
            Order CSV <span className="text-red-600 dark:text-red-400">*</span>
          </span>
          {/* No shared file field exists; the native control keeps the OS
              picker and its keyboard behaviour. */}
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            aria-required="true"
            disabled={saving}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-2 block w-full rounded-xl border border-black/15 bg-white p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-black/[0.06] file:px-3 file:py-2 file:text-xs file:font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/15 dark:bg-white/[0.04] dark:file:bg-white/10 dark:file:text-white dark:focus-visible:ring-white/40"
          />
        </label>
        <ErrorCallout>{error}</ErrorCallout>
      </div>
    </Modal>
  );
}

/** One numbered step of a manual send, with its actions beside it. */
function DraftStep({
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

/** Bcc set apart, since putting buyers in To would show everyone's address. */
const BccTag = () => (
  <span className="rounded-md border border-black/15 bg-black/[0.05] px-1.5 py-px font-mono text-[0.85em] font-semibold text-black dark:border-white/20 dark:bg-white/10 dark:text-white">
    Bcc
  </span>
);

const draftText = (draft: RydDraft) =>
  `Subject: ${draft.subject}\n\n${draft.body}`;

const BCC_INTRO = (
  <>
    Every recipient goes in <BccTag />, so nobody sees anyone else&apos;s
    address.
  </>
);

/** One Bcc draft to a group of people, previewed with ways to send it. */
function BulkDraftCard({
  label,
  addresses,
  draft,
}: {
  label: string;
  addresses: string[];
  draft: RydDraft;
}) {
  return (
    <li className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <Pill variant="neutral" size="sm">
          {addresses.length} {addresses.length === 1 ? "person" : "people"}
        </Pill>
      </div>
      <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.02] p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
        <p className="font-semibold">{draft.subject}</p>
        <p className="mt-2 whitespace-pre-line break-words text-black/70 dark:text-white/70">
          {draft.body}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button.Link
          href={rydMailtoHref({ bcc: addresses, ...draft })}
          size="xs"
          variant="secondary"
          leftIcon={<FiMail aria-hidden />}
          prefetch={false}
        >
          Open draft
        </Button.Link>
        <CopyButton value={addresses.join(", ")} label="Addresses">
          Copy addresses
        </CopyButton>
        <CopyButton value={draftText(draft)} label="Email">
          Copy email
        </CopyButton>
      </div>
    </li>
  );
}

const BULK_FALLBACK = (
  <p className="mt-4 text-sm text-black/70 dark:text-white/70">
    Draft didn&apos;t open? Copy the addresses into <BccTag />, then paste the
    email.
  </p>
);

export function RydSendDialog({
  queue,
  onClose,
  onChanged,
}: {
  queue: RydQueue;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const total = queue.orders.length;
  const ready = queue.orders.filter((order) => order.status === "verified");
  const recipient = queue.settings.fulfillmentEmail;
  const draft = rydFulfillmentEmail(ready, total);

  async function markSent() {
    setSending(true);
    try {
      const result = await mutate<{
        verifiedCount: number;
        orderCount: number;
        sheetTicks: number | null;
      }>("/api/ryd/batches", {
        method: "POST",
        body: JSON.stringify({ orderIds: ready.map((order) => order.orderId) }),
      });
      await onChanged();
      toast.success(
        `Marked sent: ${result.verifiedCount} of ${result.orderCount} cleared to start.` +
          (result.sheetTicks === null && result.verifiedCount
            ? " The response sheet couldn't be ticked; tick it by hand if you keep it."
            : ""),
      );
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "The batch couldn't be marked sent."));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open
      setIsOpen={(open) => !open && !sending && onClose()}
      size="lg"
      title="Send to fulfillment"
      description="Fulfillment gets back their own file with Verified? filled in. Send it from your own email, then mark it sent: verified orders leave the queue, and everything else comes round again next time."
      closable={!sending}
      actions={
        <ModalActions
          confirmLabel="Mark as sent"
          confirmIcon={<FiCheck aria-hidden />}
          onConfirm={markSent}
          confirmDisabled={!ready.length}
          onCancel={onClose}
          pending={sending}
          pendingLabel="Marking..."
        />
      }
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ["In the file", total],
          ["Cleared to start", ready.length],
          ["Still being checked", total - ready.length],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-black/10 p-4 dark:border-white/10"
          >
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-black/70 dark:text-white/70">
              {label}
            </dt>
            <dd className="mt-1 font-cooper text-3xl">{value}</dd>
          </div>
        ))}
      </dl>
      <ol className="mt-6 space-y-4">
        <DraftStep
          index={1}
          title="Download the file"
          description="Every open order, with Verified? ticked on the ones ready to start."
        >
          <Button.Link
            href="/api/ryd/export"
            size="xs"
            variant="secondary"
            leftIcon={<FiDownload aria-hidden />}
            prefetch={false}
            download
          >
            Download CSV
          </Button.Link>
        </DraftStep>
        <DraftStep
          index={2}
          title="Email it to fulfillment"
          description={
            <>
              Opens a draft
              {recipient ? (
                <>
                  {" "}
                  to <span className="font-semibold">{recipient}</span>
                </>
              ) : null}{" "}
              listing the {ready.length} ready order
              {ready.length === 1 ? "" : "s"}. Attach the file, then send.
              {!recipient &&
                " Add fulfillment's address in RY-D settings to fill it in."}
            </>
          }
        >
          <Button.Link
            href={rydMailtoHref({ to: recipient ? [recipient] : [], ...draft })}
            size="xs"
            variant="secondary"
            leftIcon={<FiMail aria-hidden />}
            prefetch={false}
          >
            Open draft
          </Button.Link>
          <CopyButton value={draftText(draft)} label="Email">
            Copy email
          </CopyButton>
        </DraftStep>
        <DraftStep
          index={3}
          title="Mark it sent"
          description="Once it's sent, Mark as sent clears the ready orders and ticks them in the form's response sheet."
        />
      </ol>
    </Modal>
  );
}

export function RydRemindDialog({
  orders,
  onClose,
  onChanged,
}: {
  orders: RydQueueOrder[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [marking, setMarking] = useState(false);
  // Someone who already sent something is asked for more, not to start.
  const groups = [false, true]
    .map((hasSubmission) => ({
      hasSubmission,
      orders: orders.filter(
        (order) => order.linkedKeys.length > 0 === hasSubmission,
      ),
    }))
    .filter((group) => group.orders.length);

  async function markEmailed() {
    setMarking(true);
    try {
      const result = await mutate<{ markedCount: number }>(
        "/api/ryd/reminders",
        {
          method: "POST",
          body: JSON.stringify({
            orderIds: orders.map((order) => order.orderId),
          }),
        },
      );
      await onChanged();
      toast.success(
        `Marked ${result.markedCount} buyer${result.markedCount === 1 ? "" : "s"} as emailed.`,
      );
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Those emails couldn't be recorded."));
    } finally {
      setMarking(false);
    }
  }

  return (
    <Modal
      open
      setIsOpen={(open) => !open && !marking && onClose()}
      size="lg"
      title="Email everyone"
      description={
        <>
          {BCC_INTRO} Once it&apos;s sent, mark them emailed here and they
          won&apos;t be asked again for a day.
        </>
      }
      closable={!marking}
      actions={
        <ModalActions
          confirmLabel={`Mark ${orders.length} as emailed`}
          confirmIcon={<FiCheck aria-hidden />}
          onConfirm={markEmailed}
          onCancel={onClose}
          pending={marking}
          pendingLabel="Marking..."
        />
      }
    >
      <ul className="space-y-4">
        {groups.map((group) => (
          <BulkDraftCard
            key={String(group.hasSubmission)}
            label={
              group.hasSubmission
                ? "Sent something, needs more"
                : "Nothing sent yet"
            }
            addresses={group.orders.map((order) => order.displayEmail)}
            draft={rydBuyerEmail({ hasSubmission: group.hasSubmission })}
          />
        ))}
      </ul>
      {BULK_FALLBACK}
    </Modal>
  );
}

/**
 * Emails everyone whose form answers no order claims, then records the
 * attempt. A reply brings the order email back, and linking it clears them.
 */
export function RydUnmatchedEmailDialog({
  submitters,
  onClose,
  onChanged,
}: {
  submitters: RydSubmitter[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [marking, setMarking] = useState(false);

  async function markContacted() {
    setMarking(true);
    try {
      const result = await mutate<{ markedCount: number }>(
        "/api/ryd/submitter-contacts",
        {
          method: "POST",
          body: JSON.stringify({
            emails: submitters.map((submitter) => submitter.email),
          }),
        },
      );
      await onChanged();
      toast.success(
        `Marked ${result.markedCount} ${result.markedCount === 1 ? "person" : "people"} as contacted.`,
      );
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Those contacts couldn't be recorded."));
    } finally {
      setMarking(false);
    }
  }

  return (
    <Modal
      open
      setIsOpen={(open) => !open && !marking && onClose()}
      size="lg"
      title="Email unmatched submitters"
      description={
        <>
          {BCC_INTRO} Once it&apos;s sent, mark them contacted here: each one
          counts as another attempt, and they won&apos;t be asked again for a
          day.
        </>
      }
      closable={!marking}
      actions={
        <ModalActions
          confirmLabel={`Mark ${submitters.length} as contacted`}
          confirmIcon={<FiCheck aria-hidden />}
          onConfirm={markContacted}
          onCancel={onClose}
          pending={marking}
          pendingLabel="Marking..."
        />
      }
    >
      <ul className="space-y-4">
        <BulkDraftCard
          label="No matching order"
          addresses={submitters.map((submitter) => submitter.email)}
          draft={rydUnmatchedEmail()}
        />
      </ul>
      {BULK_FALLBACK}
    </Modal>
  );
}

export function RydSettingsDialog({
  queue,
  googleConfigured,
  onClose,
  onChanged,
}: {
  queue: RydQueue;
  googleConfigured: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState(
    queue.settings.formId
      ? `https://docs.google.com/forms/d/${queue.settings.formId}/edit`
      : "",
  );
  const [fulfillmentEmail, setFulfillmentEmail] = useState(
    queue.settings.fulfillmentEmail ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const connected = queue.sheet.status !== "disconnected";
  const accountEmail =
    "accountEmail" in queue.sheet ? queue.sheet.accountEmail : null;

  return (
    <Modal
      open
      setIsOpen={(open) => !open && !saving && onClose()}
      size="lg"
      title="RY-D settings"
      description="The form buyers verify through, and who gets the finished file."
      closable={!saving}
      formId={SETTINGS_FORM}
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await mutate("/api/ryd/settings", {
            method: "PATCH",
            body: JSON.stringify({ form, fulfillmentEmail }),
          });
          await onChanged();
          toast.success("RY-D settings saved.");
          onClose();
        } catch (error) {
          toast.error(
            errorMessage(
              error,
              "Use the form's editor link (it has /forms/d/ and no /e/) and a full email address.",
            ),
          );
        } finally {
          setSaving(false);
        }
      }}
      actions={
        <ModalActions
          confirmForm={SETTINGS_FORM}
          confirmLabel="Save settings"
          onCancel={onClose}
          pending={saving}
          pendingLabel="Saving..."
        />
      }
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Google account</h3>
          <p className="mt-1 text-sm text-black/70 dark:text-white/70">
            {connected
              ? `Connected as ${accountEmail}. Sign in again as a different account to switch.`
              : "Sign in as the account that owns the RY-dentification form, so the app can read its responses, open uploads, and tick Verified? in its response sheet."}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {googleConfigured ? (
              <Button.Link
                href="/api/integrations/ryd-google/connect"
                size="sm"
                variant={connected ? "secondary" : "primary"}
                prefetch={false}
              >
                {connected ? "Reconnect Google" : "Connect Google"}
              </Button.Link>
            ) : (
              <p className="text-sm font-semibold">
                Google sign-in isn&apos;t configured on this instance.
              </p>
            )}
            {connected && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                leftIcon={<FiLogOut aria-hidden />}
                loading={disconnecting}
                onClick={async () => {
                  setDisconnecting(true);
                  try {
                    await mutate("/api/integrations/ryd-google/disconnect", {
                      method: "POST",
                      body: "{}",
                    });
                    await onChanged();
                    toast.success("Google disconnected.");
                  } catch (error) {
                    toast.error(
                      errorMessage(error, "Google couldn't be disconnected."),
                    );
                  } finally {
                    setDisconnecting(false);
                  }
                }}
              >
                Disconnect
              </Button>
            )}
          </div>
        </section>

        <Input
          name="form"
          label="RY-dentification form"
          required
          value={form}
          onChange={(event) => setForm(event.target.value)}
          placeholder="https://docs.google.com/forms/d/…/edit"
          disabled={saving}
        />
        <Input
          name="fulfillmentEmail"
          type="email"
          label="Fulfillment email"
          required
          value={fulfillmentEmail}
          onChange={(event) => setFulfillmentEmail(event.target.value)}
          placeholder="orders@fulfillment.example"
          disabled={saving}
        />
      </div>
    </Modal>
  );
}
