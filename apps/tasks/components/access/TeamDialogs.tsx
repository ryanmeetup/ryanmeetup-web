"use client";

import type { FormEvent } from "react";
import { ConfirmationDialog, Input, Modal, ModalActions } from "@ryanmeetup/ui";
import type { Profile } from "@/lib/workspace/workspace-types";
import {
  ProfileAccessFields,
  type AccessGroupOption,
} from "./ProfileAccessFields";

export function InviteTeammateModal({
  appRole,
  email,
  groups,
  name,
  onEmailChange,
  onNameChange,
  onSubmit,
  open,
  pending,
  selections,
  setAppRole,
  setOpen,
  setSelections,
}: {
  appRole: "owner" | "member";
  email: string;
  groups: AccessGroupOption[];
  name: string;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  open: boolean;
  pending: boolean;
  selections: string[];
  setAppRole: (role: "owner" | "member") => void;
  setOpen: (open: boolean) => void;
  setSelections: (update: (current: string[]) => string[]) => void;
}) {
  return (
    <Modal
      open={open}
      setIsOpen={(nextOpen) => {
        if (!pending) setOpen(nextOpen);
      }}
      title="Invite Teammate"
      size="md"
      actions={
        <ModalActions
          confirmForm="invite-teammate-form"
          confirmLabel="Send invitation"
          onCancel={() => setOpen(false)}
          pending={pending}
          pendingLabel="Inviting..."
        />
      }
    >
      <form id="invite-teammate-form" className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            name="invite-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="New teammate"
            disabled={pending}
          />
          <Input
            label="Email"
            name="invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="ryan@example.com"
            disabled={pending}
          />
        </div>
        <div
          role="group"
          aria-labelledby="invite-access-heading"
          className="space-y-4 border-t border-black/10 pt-4 dark:border-white/10"
        >
          <h3 id="invite-access-heading" className="font-semibold">
            Access
          </h3>
          <p className="text-sm text-black/65 dark:text-white/65">
            Set their access now, so they arrive with it. A partner goes in a
            guest tier plus the team for their work.
          </p>
          <ProfileAccessFields
            appRole={appRole}
            groups={groups}
            pending={pending}
            selections={selections}
            setAppRole={setAppRole}
            setSelections={setSelections}
          />
        </div>
      </form>
    </Modal>
  );
}

export function RemoveTeammateDialog({
  onConfirm,
  pending,
  profile,
  setProfile,
}: {
  onConfirm: () => void;
  pending: boolean;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
}) {
  return (
    <ConfirmationDialog
      open={Boolean(profile)}
      setOpen={(open) => {
        if (!open && !pending) setProfile(null);
      }}
      title="Remove Teammate?"
      description={
        profile
          ? `Remove ${profile.full_name} and revoke their workspace access?`
          : ""
      }
      confirmLabel="Remove Teammate"
      pendingLabel="Removing..."
      pending={pending}
      destructive
      onConfirm={onConfirm}
    />
  );
}
