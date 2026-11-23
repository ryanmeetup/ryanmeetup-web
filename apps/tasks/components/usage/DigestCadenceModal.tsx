"use client";

import { useState } from "react";
import {
  DropdownSelect,
  Input,
  ModalActions,
  MultiSelect,
  toast,
} from "@ryanmeetup/ui";
import {
  DIGEST_LIMITS,
  WEEKDAY_LABELS,
  type DigestSettings,
} from "@/lib/digest/digest-settings";
import { saveDigestSettings } from "@/lib/usage/digest-client";
import { errorMessage } from "@/lib/presentation";
import { DigestSurface, type DigestPresentation } from "./DigestSurface";

const FORM_ID = "digest-cadence-form";

const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour))),
}));

const weekdayOptions = WEEKDAY_LABELS.map((label, index) => ({
  value: String(index),
  label,
}));

/**
 * A short list of zones rather than the full IANA set: this is a single-tenant
 * workspace picking one operating timezone, not a per-user preference. The
 * stored value is always offered even when it is not on the list, so a zone set
 * elsewhere is never silently rewritten by opening this dialog.
 */
const COMMON_TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

export function DigestCadenceModal({
  open,
  setOpen,
  settings,
  demoMode,
  onSaved,
  presentation = "modal",
}: {
  /** On `page`, the editor is the `/admin/usage/digest/*` route. */
  presentation?: DigestPresentation;
  open: boolean;
  setOpen: (open: boolean) => void;
  settings: DigestSettings;
  demoMode: boolean;
  onSaved: (settings: DigestSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);

  // Reopening after an outside change must show the stored values, not the
  // abandoned draft from the previous visit. Reset on the open transition
  // during render rather than in an effect, so the dialog never paints the
  // stale draft first.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(settings);
  }

  const zoneOptions = [...new Set([...COMMON_TIME_ZONES, draft.timeZone])].map(
    (zone) => ({ value: zone, label: zone.replace(/_/g, " ") }),
  );

  const setField = <Key extends keyof DigestSettings>(
    key: Key,
    value: DigestSettings[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const numberField = (key: "reviewMinutes" | "maxRecipients", raw: string) => {
    const parsed = Number(raw);
    setField(key, (Number.isFinite(parsed) ? parsed : 0) as never);
  };

  const invalid =
    !draft.weekdays.length ||
    draft.reviewMinutes < DIGEST_LIMITS.reviewMinutes.min ||
    draft.reviewMinutes > DIGEST_LIMITS.reviewMinutes.max ||
    draft.maxRecipients < DIGEST_LIMITS.maxRecipients.min ||
    draft.maxRecipients > DIGEST_LIMITS.maxRecipients.max;

  const submit = async () => {
    if (invalid) return;
    if (demoMode) {
      onSaved(draft);
      toast.success("Cadence updated in demo mode.");
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      onSaved(
        await saveDigestSettings({
          enabled: draft.enabled,
          weekdays: draft.weekdays,
          sendHour: draft.sendHour,
          timeZone: draft.timeZone,
          reviewMinutes: draft.reviewMinutes,
          maxRecipients: draft.maxRecipients,
        }),
      );
      toast.success("Digest cadence saved.");
      setOpen(false);
    } catch (error) {
      toast.error(
        errorMessage(error, "The digest settings could not be saved."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DigestSurface
      presentation={presentation}
      crumb="Digest cadence"
      open={open}
      setOpen={setOpen}
      title="Edit digest cadence"
      description="The worker wakes every hour and checks these values, so a change here takes effect on the next run without a deploy."
      closable={!saving}
      formId={FORM_ID}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      actions={
        <ModalActions
          confirmDisabled={invalid}
          confirmForm={FORM_ID}
          confirmLabel="Save cadence"
          onCancel={() => setOpen(false)}
          pending={saving}
          pendingLabel="Saving..."
        />
      }
    >
      <div className="settings-form space-y-5">
        <label className="flex items-start gap-3 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
          <input
            type="checkbox"
            checked={draft.enabled}
            disabled={saving}
            onChange={(event) => setField("enabled", event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-black/30 accent-black dark:border-white/30 dark:accent-white"
          />
          <span>
            <span className="font-semibold">Send workload digests</span>
            <span className="mt-1 block text-black/60 dark:text-white/60">
              Turn this off to pause every digest without losing the schedule.
            </span>
          </span>
        </label>

        <MultiSelect
          label="Send days"
          options={weekdayOptions}
          value={draft.weekdays.map(String)}
          disabled={saving}
          searchable={false}
          summaryLimit={3}
          placeholder="Pick at least one day"
          onChange={(value) =>
            setField(
              "weekdays",
              value.map(Number).sort((left, right) => left - right),
            )
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <DropdownSelect
            label="Send hour"
            variant="field"
            options={hourOptions}
            value={String(draft.sendHour)}
            disabled={saving}
            onChange={(value) => setField("sendHour", Number(value))}
          />
          <DropdownSelect
            label="Timezone"
            variant="field"
            options={zoneOptions}
            value={draft.timeZone}
            disabled={saving}
            onChange={(value) => setField("timeZone", value)}
          />
        </div>

        <div>
          <Input
            label="Review window (minutes)"
            name="review-minutes"
            type="number"
            min={DIGEST_LIMITS.reviewMinutes.min}
            max={DIGEST_LIMITS.reviewMinutes.max}
            value={String(draft.reviewMinutes)}
            disabled={saving}
            error={
              draft.reviewMinutes < DIGEST_LIMITS.reviewMinutes.min ||
              draft.reviewMinutes > DIGEST_LIMITS.reviewMinutes.max
            }
            onChange={(event) =>
              numberField("reviewMinutes", event.target.value)
            }
          />
          <p className="mt-1.5 text-xs text-black/55 dark:text-white/55">
            How long a created message waits in Resend before delivery, so it
            can be previewed, delayed, or cancelled from the activity table.
          </p>
        </div>

        <div>
          <Input
            label="Recipients per run"
            name="max-recipients"
            type="number"
            min={DIGEST_LIMITS.maxRecipients.min}
            max={DIGEST_LIMITS.maxRecipients.max}
            value={String(draft.maxRecipients)}
            disabled={saving}
            error={
              draft.maxRecipients < DIGEST_LIMITS.maxRecipients.min ||
              draft.maxRecipients > DIGEST_LIMITS.maxRecipients.max
            }
            onChange={(event) =>
              numberField("maxRecipients", event.target.value)
            }
          />
          <p className="mt-1.5 text-xs text-black/55 dark:text-white/55">
            A ceiling on messages created per run. 90 keeps a full run inside
            the Resend free tier&rsquo;s 100-a-day limit.
          </p>
        </div>
      </div>
    </DigestSurface>
  );
}
