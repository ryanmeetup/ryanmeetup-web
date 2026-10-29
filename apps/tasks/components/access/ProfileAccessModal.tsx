"use client";

import type { FormEvent } from "react";
import { Modal, ModalActions } from "@ryanmeetup/ui";
import type { Profile } from "@/lib/workspace/workspace-types";
import {
  ProfileAccessFields,
  type AccessGroupOption,
} from "./ProfileAccessFields";

export function ProfileAccessModal({
  appRole,
  groups,
  onSubmit,
  pending,
  profile,
  selections,
  setAppRole,
  setProfile,
  setSelections,
}: {
  appRole: "owner" | "member";
  groups: AccessGroupOption[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  profile: Profile | null;
  selections: string[];
  setAppRole: (role: "owner" | "member") => void;
  setProfile: (profile: Profile | null) => void;
  setSelections: (update: (current: string[]) => string[]) => void;
}) {
  return (
    <Modal
      open={Boolean(profile)}
      setIsOpen={(open) => {
        if (!open && !pending) setProfile(null);
      }}
      title={
        profile
          ? `Access groups for ${profile.full_name}`
          : "Manage access groups"
      }
      size="md"
      actions={
        <ModalActions
          confirmForm="edit-profile-access-form"
          confirmLabel="Save access"
          onCancel={() => setProfile(null)}
          pending={pending}
          pendingLabel="Saving..."
        />
      }
    >
      <form
        id="edit-profile-access-form"
        className="space-y-4"
        onSubmit={onSubmit}
      >
        <p className="text-sm text-black/65 dark:text-white/65">
          App role controls workspace administration. Tier and teams control
          content access. These settings save together.
        </p>
        <ProfileAccessFields
          appRole={appRole}
          groups={groups}
          pending={pending}
          selections={selections}
          setAppRole={setAppRole}
          setSelections={setSelections}
        />
        {groups.length === 0 && (
          <p className="text-sm text-black/55 dark:text-white/55">
            Create an access group before assigning access here.
          </p>
        )}
      </form>
    </Modal>
  );
}
