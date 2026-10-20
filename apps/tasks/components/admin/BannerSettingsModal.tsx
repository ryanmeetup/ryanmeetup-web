"use client";

import { useState } from "react";
import { Input, Modal, ModalActions } from "@ryanmeetup/ui";
import { useInstanceSettingsForm } from "@/hooks/useInstanceSettingsForm";
import {
  bannerFields,
  overridesFromDraft,
} from "@/lib/admin/instance-settings-fields";
import {
  isBannerLinkHref,
  resolveInstanceSettings,
  type InstanceSettings,
  type InstanceSettingsOverrides,
} from "@/lib/instance";
import { BannerPreview } from "./BannerPreview";
import { InstanceSettingField } from "./InstanceSettingField";
import { SwitchField } from "./SwitchField";

const FORM_ID = "instance-banner-form";

/**
 * The message and the link label are ordinary override fields, so they follow
 * the Identity dialog: blank inherits what this deployment compiled in.
 *
 * The switch and the link are not. Neither has a blank state that could mean
 * "inherit" — an unticked box and "send people nowhere" are choices in their
 * own right — so both are seeded from the resolved setting and written only
 * when they actually change, which leaves an untouched dialog inheriting.
 */
export function BannerSettingsModal({
  open,
  setOpen,
  overrides,
  demoMode,
  baseSettings,
  onSaved,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  overrides: InstanceSettingsOverrides | null;
  demoMode: boolean;
  baseSettings: InstanceSettings;
  onSaved: (overrides: InstanceSettingsOverrides) => void;
}) {
  const { draft, setField, errors, saving, submit } = useInstanceSettingsForm({
    fields: bannerFields,
    overrides,
    demoMode,
    onSaved,
  });
  const settings = resolveInstanceSettings(overrides, baseSettings);
  const [enabled, setEnabled] = useState(settings.bannerEnabled);
  const [url, setUrl] = useState(settings.bannerLinkUrl ?? "");

  const nextUrl = url.trim() || null;
  const invalidUrl = Boolean(nextUrl && !isBannerLinkHref(nextUrl));

  const preview = resolveInstanceSettings(
    {
      ...overridesFromDraft(draft),
      bannerEnabled: enabled,
      bannerLinkUrl: invalidUrl ? settings.bannerLinkUrl : nextUrl,
    },
    baseSettings,
  );

  function changes() {
    const body: Record<string, unknown> = {};
    if (enabled !== settings.bannerEnabled) body.bannerEnabled = enabled;
    if (nextUrl !== settings.bannerLinkUrl) body.bannerLinkUrl = nextUrl;
    return body;
  }

  return (
    <Modal
      open={open}
      setIsOpen={setOpen}
      size="lg"
      title="Edit banner"
      description="The notice above the workspace: what it says, and where it sends anyone who wants to act on it."
      closable={!saving}
      formId={FORM_ID}
      onSubmit={async (event) => {
        event.preventDefault();
        const saved = await submit({
          extraBody: changes(),
          extraError: invalidUrl
            ? "The banner link needs a full https:// address or a mailto: email link."
            : undefined,
        });
        if (saved) setOpen(false);
      }}
      actions={
        <ModalActions
          confirmForm={FORM_ID}
          confirmLabel="Save banner"
          onCancel={() => setOpen(false)}
          pending={saving}
          pendingLabel="Saving..."
        />
      }
    >
      <div className="settings-form space-y-5">
        <BannerPreview settings={preview} />

        <SwitchField
          label="Show the banner"
          description="A dismissible notice above the workspace. Turn it off and members see the workspace with nothing above it."
          checked={enabled}
          disabled={saving}
          onChange={setEnabled}
        />

        <InstanceSettingField
          spec={bannerFields[0]}
          defaults={baseSettings}
          value={draft.bannerMessage}
          error={errors.bannerMessage}
          overridden={Boolean(draft.bannerMessage.trim())}
          disabled={saving}
          onChange={(value) => setField("bannerMessage", value)}
          onReset={() => setField("bannerMessage", "")}
        />

        <div className="space-y-2">
          <Input
            label="Link"
            name="bannerLinkUrl"
            value={url}
            maxLength={2048}
            placeholder="e.g. https://example.com/status or mailto:team@example.com"
            error={invalidUrl}
            disabled={saving}
            onChange={(event) => setUrl(event.target.value)}
          />
          <p
            className="text-xs leading-relaxed text-black/55 dark:text-white/55"
            role={invalidUrl ? "alert" : undefined}
          >
            {invalidUrl
              ? "Enter a full https:// address or a mailto: email link."
              : "An https page or a mailto address. Leave it empty to offer no link at all."}
          </p>
        </div>

        <InstanceSettingField
          spec={bannerFields[1]}
          defaults={baseSettings}
          value={draft.bannerLinkLabel}
          error={errors.bannerLinkLabel}
          overridden={Boolean(draft.bannerLinkLabel.trim())}
          disabled={saving}
          onChange={(value) => setField("bannerLinkLabel", value)}
          onReset={() => setField("bannerLinkLabel", "")}
        />
      </div>
    </Modal>
  );
}
