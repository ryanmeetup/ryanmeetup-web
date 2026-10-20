"use client";

import { useState } from "react";
import {
  Button,
  ErrorCallout,
  Input,
  Modal,
  ModalActions,
  toast,
} from "@ryanmeetup/ui";
import { FiDownload, FiLogOut, FiSend, FiUpload } from "react-icons/fi";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import type { RydQueue } from "@/lib/ryd/queue-types";

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

export function RydSendDialog({
  queue,
  emailConfigured,
  onClose,
  onChanged,
}: {
  queue: RydQueue;
  emailConfigured: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const total = queue.orders.length;
  const verified = queue.orders.filter(
    (order) => order.status === "verified",
  ).length;
  const recipient = queue.settings.fulfillmentEmail;
  const blocker = !emailConfigured
    ? "Email isn't set up on this instance, so download the file and send it yourself."
    : !recipient
      ? "Add fulfillment's email address in RY-D settings to send from here."
      : !total
        ? "There are no orders to send."
        : null;

  async function send() {
    setSending(true);
    try {
      const result = await mutate<{
        verifiedCount: number;
        orderCount: number;
        sheetTicks: number | null;
      }>("/api/ryd/batches", { method: "POST", body: "{}" });
      await onChanged();
      toast.success(
        `Sent ${result.orderCount} orders to ${recipient}, ${result.verifiedCount} cleared to start.` +
          (result.sheetTicks === null && result.verifiedCount
            ? " The response sheet couldn't be ticked; tick it by hand if you keep it."
            : ""),
      );
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "The batch couldn't be sent."));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open
      setIsOpen={(open) => !open && !sending && onClose()}
      title="Send to fulfillment"
      description="Fulfillment gets back their own file with Verified? filled in. Verified orders leave the queue once sent; everything else comes round again next time."
      closable={!sending}
      supportingActions={
        <Button.Link
          href="/api/ryd/export"
          size="sm"
          variant="ghost"
          leftIcon={<FiDownload aria-hidden />}
          prefetch={false}
          download
        >
          Download CSV
        </Button.Link>
      }
      actions={
        <ModalActions
          confirmLabel="Send"
          confirmIcon={<FiSend aria-hidden />}
          onConfirm={send}
          confirmDisabled={Boolean(blocker)}
          onCancel={onClose}
          pending={sending}
          pendingLabel="Sending..."
        />
      }
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ["In the file", total],
          ["Cleared to start", verified],
          ["Still being checked", total - verified],
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
      <p className="mt-4 text-sm text-black/70 dark:text-white/70">
        {recipient ? (
          <>
            Goes to <span className="font-semibold">{recipient}</span>, then the
            verified buyers are ticked in the form&apos;s response sheet.
          </>
        ) : (
          "No fulfillment address yet."
        )}
      </p>
      {blocker && <p className="mt-2 text-sm font-semibold">{blocker}</p>}
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
