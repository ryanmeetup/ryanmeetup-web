"use client";

import { useState } from "react";
import { Modal, ModalActions } from "@ryanmeetup/ui";
import { useInstanceSettingsForm } from "@/hooks/useInstanceSettingsForm";
import {
  resolveInstanceSettings,
  type InstanceSettings,
  type InstanceSettingsOverrides,
} from "@/lib/instance";
import { SwitchField } from "./SwitchField";

const FORM_ID = "instance-features-form";

/**
 * Pages only some instances have. Like the banner switch, an unticked box is a
 * choice rather than a blank, so the value is seeded from the resolved setting
 * and written only when it changes.
 */
export function FeatureSettingsModal({
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
  const { saving, submit } = useInstanceSettingsForm({
    fields: [],
    overrides,
    demoMode,
    onSaved,
  });
  const settings = resolveInstanceSettings(overrides, baseSettings);
  const [rydEnabled, setRydEnabled] = useState(settings.rydEnabled);

  return (
    <Modal
      open={open}
      setIsOpen={setOpen}
      size="lg"
      title="Edit features"
      description="Pages that belong to this instance and not every workspace."
      closable={!saving}
      formId={FORM_ID}
      onSubmit={async (event) => {
        event.preventDefault();
        const saved = await submit({
          extraBody: rydEnabled !== settings.rydEnabled ? { rydEnabled } : {},
        });
        if (saved) setOpen(false);
      }}
      actions={
        <ModalActions
          confirmForm={FORM_ID}
          confirmLabel="Save features"
          onCancel={() => setOpen(false)}
          pending={saving}
          pendingLabel="Saving..."
        />
      }
    >
      <div className="settings-form space-y-5">
        <SwitchField
          label="RY-D verification"
          description="Match fulfillment's weekly order file against the RY-dentification form, record who is verified, and send the result back. The page starts open to owners only; grant it to an access group from Access."
          checked={rydEnabled}
          disabled={saving}
          onChange={setRydEnabled}
        />
      </div>
    </Modal>
  );
}
