"use client";

import type { FormEvent } from "react";
import {
  DropdownSelect,
  Input,
  Modal,
  ModalActions,
  Textarea,
} from "@ryanmeetup/ui";
import { ACCESS_GROUP_COLOR_OPTIONS } from "@/lib/access/access-groups";

export function CreateAccessGroupModal({
  color,
  calendarAccess,
  description,
  grantsGlobalContent,
  guest,
  hierarchyRank,
  kind,
  name,
  onSubmit,
  open,
  saving,
  setColor,
  setCalendarAccess,
  setDescription,
  setGrantsGlobalContent,
  setGuest,
  setHierarchyRank,
  setKind,
  setName,
  setOpen,
}: {
  color: string;
  calendarAccess: boolean;
  description: string;
  grantsGlobalContent: boolean;
  guest: boolean;
  hierarchyRank: string;
  kind: "tier" | "team";
  name: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  saving: boolean;
  setColor: (value: string) => void;
  setCalendarAccess: (value: boolean) => void;
  setDescription: (value: string) => void;
  setGrantsGlobalContent: (value: boolean) => void;
  setGuest: (value: boolean) => void;
  setHierarchyRank: (value: string) => void;
  setKind: (value: "tier" | "team") => void;
  setName: (value: string) => void;
  setOpen: (open: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      setIsOpen={(nextOpen) => {
        if (!saving) setOpen(nextOpen);
      }}
      title="New Access Group"
      size="md"
      actions={
        <ModalActions
          confirmDisabled={!name.trim() || !color}
          confirmForm="create-access-group-form"
          confirmLabel="Create group"
          onCancel={() => setOpen(false)}
          pending={saving}
          pendingLabel="Creating..."
        />
      }
    >
      <form
        id="create-access-group-form"
        className="space-y-4"
        onSubmit={onSubmit}
      >
        <Input
          label="Group name"
          name="access-group-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Documentary Team"
          disabled={saving}
          autoFocus
          required
        />
        <DropdownSelect
          label="Group type"
          required
          variant="field"
          value={kind}
          onChange={(value) => setKind(value as "tier" | "team")}
          options={[
            { label: "Team", value: "team" },
            { label: "Organizational Tier", value: "tier" },
          ]}
          disabled={saving}
        />
        {kind === "tier" && (
          <>
            <Input
              label="Hierarchy rank"
              name="access-group-rank"
              type="number"
              min="0"
              value={hierarchyRank}
              onChange={(event) => setHierarchyRank(event.target.value)}
              disabled={saving}
              required
            />
            <p className="text-sm text-black/65 dark:text-white/65">
              Higher numbers inherit access granted to lower ranks.
            </p>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={grantsGlobalContent && !guest}
                onChange={(event) =>
                  setGrantsGlobalContent(event.target.checked)
                }
                disabled={saving || guest}
              />
              <span>Grant manager access to all current and future work</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={guest}
                onChange={(event) => setGuest(event.target.checked)}
                disabled={saving}
              />
              <span>
                Guest tier
                <span className="mt-1 block text-black/60 dark:text-white/60">
                  For people outside the organization. Members reach only what
                  is granted to this tier or their teams, never work or pages
                  open to the workspace, and inherit nothing from other tiers.
                </span>
              </span>
            </label>
          </>
        )}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={calendarAccess}
            onChange={(event) => setCalendarAccess(event.target.checked)}
            disabled={saving}
          />
          <span>
            View the workspace Google Calendar
            <span className="mt-1 block text-black/60 dark:text-white/60">
              Members of this group can see events synced from Google.
            </span>
          </span>
        </label>
        <DropdownSelect
          label="Color"
          variant="field"
          value={color}
          onChange={setColor}
          options={ACCESS_GROUP_COLOR_OPTIONS}
          disabled={saving}
          required
        />
        <Textarea
          id="access-group-description"
          label="Description"
          name="access-group-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Who belongs here and why?"
          disabled={saving}
        />
      </form>
    </Modal>
  );
}
