"use client";

import { useState } from "react";
import { IconButton, Input, ModalActions, toast } from "@ryanmeetup/ui";
import { FiArrowDown, FiArrowUp } from "react-icons/fi";
import {
  DIGEST_LIMITS,
  DIGEST_SECTION_KEYS,
  DIGEST_SECTION_META,
  type DigestSectionKey,
  type DigestSettings,
} from "@/lib/digest/digest-settings";
import { saveDigestSettings } from "@/lib/usage/digest-client";
import { errorMessage } from "@/lib/presentation";
import { DigestSurface, type DigestPresentation } from "./DigestSurface";

const FORM_ID = "digest-structure-form";

export function DigestStructureModal({
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

  // Enabled sections keep their configured order; disabled ones are appended so
  // the dialog is one list of every section rather than two lists to reconcile.
  const ordered: DigestSectionKey[] = [
    ...draft.sections,
    ...DIGEST_SECTION_KEYS.filter((key) => !draft.sections.includes(key)),
  ];

  const toggle = (key: DigestSectionKey) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.includes(key)
        ? current.sections.filter((section) => section !== key)
        : [...current.sections, key],
    }));

  /** Move an enabled section one place up or down within the enabled list. */
  const move = (key: DigestSectionKey, direction: -1 | 1) =>
    setDraft((current) => {
      const index = current.sections.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.sections.length)
        return current;
      const sections = [...current.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...current, sections };
    });

  const numberField = (key: "upcomingDays" | "recentDays", raw: string) => {
    const parsed = Number(raw);
    setDraft((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  const outOfRange = (key: "upcomingDays" | "recentDays") =>
    draft[key] < DIGEST_LIMITS[key].min || draft[key] > DIGEST_LIMITS[key].max;

  const invalid =
    !draft.sections.length ||
    outOfRange("upcomingDays") ||
    outOfRange("recentDays");

  const submit = async () => {
    if (invalid) return;
    if (demoMode) {
      onSaved(draft);
      toast.success("Structure updated in demo mode.");
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      onSaved(
        await saveDigestSettings({
          sections: draft.sections,
          upcomingDays: draft.upcomingDays,
          recentDays: draft.recentDays,
        }),
      );
      toast.success("Digest structure saved.");
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
      crumb="Digest structure"
      open={open}
      setOpen={setOpen}
      title="Edit digest structure"
      description="Which sections a digest contains, and the order they appear in. A recipient with nothing in any enabled section is skipped rather than emailed an empty rundown."
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
          confirmLabel="Save structure"
          onCancel={() => setOpen(false)}
          pending={saving}
          pendingLabel="Saving..."
        />
      }
    >
      <div className="settings-form space-y-5">
        <ul className="divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
          {ordered.map((key) => {
            const meta = DIGEST_SECTION_META[key];
            const enabled = draft.sections.includes(key);
            const position = draft.sections.indexOf(key);
            return (
              <li key={key} className="flex items-start gap-3 p-4">
                <input
                  type="checkbox"
                  id={`digest-section-${key}`}
                  checked={enabled}
                  disabled={saving}
                  onChange={() => toggle(key)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-black/30 accent-black dark:border-white/30 dark:accent-white"
                />
                <label
                  htmlFor={`digest-section-${key}`}
                  className="min-w-0 flex-1 text-sm"
                >
                  <span className="font-semibold">
                    <span aria-hidden>{meta.emoji}</span> {meta.label}
                  </span>
                  <span className="mt-1 block text-black/60 dark:text-white/60">
                    {meta.description}
                  </span>
                </label>
                <span className="flex shrink-0 items-center gap-1">
                  <IconButton
                    type="button"
                    size="sm"
                    variant="subtle"
                    label={`Move ${meta.label} earlier`}
                    disabled={saving || !enabled || position <= 0}
                    onClick={() => move(key, -1)}
                  >
                    <FiArrowUp aria-hidden />
                  </IconButton>
                  <IconButton
                    type="button"
                    size="sm"
                    variant="subtle"
                    label={`Move ${meta.label} later`}
                    disabled={
                      saving ||
                      !enabled ||
                      position === draft.sections.length - 1
                    }
                    onClick={() => move(key, 1)}
                  >
                    <FiArrowDown aria-hidden />
                  </IconButton>
                </span>
              </li>
            );
          })}
        </ul>
        {!draft.sections.length && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Keep at least one section enabled.
          </p>
        )}

        <div>
          <Input
            label="“Coming up” window (days)"
            name="upcoming-days"
            type="number"
            min={DIGEST_LIMITS.upcomingDays.min}
            max={DIGEST_LIMITS.upcomingDays.max}
            value={String(draft.upcomingDays)}
            disabled={saving}
            error={outOfRange("upcomingDays")}
            onChange={(event) =>
              numberField("upcomingDays", event.target.value)
            }
          />
          <p className="mt-1.5 text-xs text-black/55 dark:text-white/55">
            How far ahead a due date has to be before it drops out of the digest
            entirely.
          </p>
        </div>

        <div>
          <Input
            label="“Recently updated” window (days)"
            name="recent-days"
            type="number"
            min={DIGEST_LIMITS.recentDays.min}
            max={DIGEST_LIMITS.recentDays.max}
            value={String(draft.recentDays)}
            disabled={saving}
            error={outOfRange("recentDays")}
            onChange={(event) => numberField("recentDays", event.target.value)}
          />
          <p className="mt-1.5 text-xs text-black/55 dark:text-white/55">
            How far back the digest looks for changes to assigned work.
          </p>
        </div>
      </div>
    </DigestSurface>
  );
}
