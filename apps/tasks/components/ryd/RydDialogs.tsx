"use client";

import { useState } from "react";
import {
  Button,
  DropdownSelect,
  ErrorCallout,
  Input,
  Modal,
  ModalActions,
  Text,
  toast,
} from "@ryanmeetup/ui";
import { FiLogOut, FiUpload } from "react-icons/fi";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import type { RydImportSummary } from "@/lib/ryd/orders";
import type { RydQueueChange } from "@/lib/ryd/queue-reconciliation";
import type { RydQueue, RydSettings } from "@/lib/ryd/queue-types";
import { WEEKDAY_LABELS } from "@/lib/digest/digest-settings";
import { rydHourLabel } from "@/lib/ryd/upload-reminder";
import { formIdFrom } from "@/lib/ryd/form-responses";
import { RYD_FORM_URL } from "@/lib/ryd/emails";

export { RydRemindDialog } from "./RydRemindDialog";
export { RydSendDialog } from "./RydSendDialog";

const UPLOAD_FORM = "ryd-upload-form";
const SETTINGS_FORM = "ryd-settings-form";

const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((label, index) => ({
  value: String(index),
  label,
}));
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: rydHourLabel(hour),
}));

function importSummary(result: RydImportSummary) {
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
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
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
          body.set("operationId", operationId);
          const result = await mutate<RydImportSummary>("/api/ryd/imports", {
            method: "POST",
            body,
          });
          toast.success(importSummary(result));
          try {
            await onChanged();
          } catch {
            toast.error(
              "The file imported, but the queue could not reload. Refresh the page to see it.",
            );
          }
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
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setOperationId(crypto.randomUUID());
            }}
            className="mt-2 block w-full rounded-xl border border-black/15 bg-white p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-black/[0.06] file:px-3 file:py-2 file:text-xs file:font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/15 dark:bg-white/[0.04] dark:file:bg-white/10 dark:file:text-white dark:focus-visible:ring-white/40"
          />
        </label>
        <ErrorCallout>{error}</ErrorCallout>
      </div>
    </Modal>
  );
}

export function RydSettingsDialog({
  queue,
  googleConfigured,
  onClose,
  onChanged,
  onApplied,
}: {
  queue: RydQueue;
  googleConfigured: boolean;
  onApplied: (change: RydQueueChange) => void;
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
  const [uploadReminder, setUploadReminder] = useState(
    queue.settings.uploadReminder,
  );
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const busy = saving || disconnecting;
  const connected = queue.sheet.status !== "disconnected";
  const accountEmail =
    "accountEmail" in queue.sheet ? queue.sheet.accountEmail : null;
  const reviewFormId = formIdFrom(form);

  return (
    <Modal
      open
      setIsOpen={(open) => !open && !busy && onClose()}
      size="lg"
      title="RY-D settings"
      description="The form buyers verify through, and who gets the finished file."
      closable={!busy}
      formId={SETTINGS_FORM}
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          const settings = await mutate<RydSettings>("/api/ryd/settings", {
            method: "PATCH",
            body: JSON.stringify({ form, fulfillmentEmail, uploadReminder }),
          });
          onApplied({ type: "settings", settings });
          void onChanged().catch(() => {});
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
          confirmDisabled={disconnecting}
          cancelDisabled={busy}
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
                disabled={busy}
                className="w-full sm:w-auto"
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
                disabled={busy}
                className="w-full sm:w-auto"
                onClick={async () => {
                  setDisconnecting(true);
                  try {
                    await mutate("/api/integrations/ryd-google/disconnect", {
                      method: "POST",
                      body: "{}",
                    });
                    onApplied({ type: "disconnect" });
                    void onChanged().catch(() => {});
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
          disabled={busy}
          aria-describedby="ryd-form-guidance"
        />
        <Text id="ryd-form-guidance" className="!text-sm">
          Buyers and reminder drafts use the{" "}
          <a
            href={RYD_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="break-words underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            buyer verification link
          </a>
          . This setting changes only the form reviewers read; it does not
          update that public redirect. Before saving, open both links and
          confirm they lead to the same Google form.
          {reviewFormId && (
            <>
              {" "}
              <a
                href={`https://docs.google.com/forms/d/${reviewFormId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Open review form editor
              </a>
              .
            </>
          )}
        </Text>
        <Input
          name="fulfillmentEmail"
          type="email"
          label="Fulfillment email"
          required
          value={fulfillmentEmail}
          onChange={(event) => setFulfillmentEmail(event.target.value)}
          placeholder="orders@fulfillment.example"
          disabled={busy}
        />

        <section className="space-y-4 border-t border-black/10 pt-6 dark:border-white/10">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={uploadReminder.enabled}
              disabled={busy}
              onChange={(event) =>
                setUploadReminder({
                  ...uploadReminder,
                  enabled: event.target.checked,
                })
              }
              className="mt-0.5 h-4 w-4 rounded border-black/30 accent-black dark:border-white/30 dark:accent-white"
            />
            <span>
              <span className="font-semibold">Weekly upload reminder</span>
              <span className="mt-1 block text-black/70 dark:text-white/70">
                Emails everyone who can open RY-D Verification to check for
                fulfillment&apos;s new orders, and flags this page until someone
                uploads. Times are in the workspace time zone,{" "}
                {queue.timeZone.replace(/_/g, " ")}.
              </span>
            </span>
          </label>
          {uploadReminder.enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <DropdownSelect
                label="Day"
                variant="field"
                required
                options={WEEKDAY_OPTIONS}
                value={String(uploadReminder.weekday)}
                disabled={busy}
                onChange={(value) =>
                  setUploadReminder({
                    ...uploadReminder,
                    weekday: Number(value),
                  })
                }
              />
              <DropdownSelect
                label="Time"
                variant="field"
                required
                options={HOUR_OPTIONS}
                value={String(uploadReminder.hour)}
                disabled={busy}
                onChange={(value) =>
                  setUploadReminder({ ...uploadReminder, hour: Number(value) })
                }
              />
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
