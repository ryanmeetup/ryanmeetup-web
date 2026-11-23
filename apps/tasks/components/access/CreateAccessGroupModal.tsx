"use client";

import { useState, type FormEvent } from "react";
import {
  DropdownSelect,
  ErrorCallout,
  Input,
  ModalActions,
  Textarea,
} from "@ryanmeetup/ui";
import { FiPlus, FiUsers } from "react-icons/fi";
import { EditorSurface } from "@/components/global";
import {
  ACCESS_GROUP_COLOR_OPTIONS,
  isReservedAccessGroupName,
} from "@/lib/access/access-groups";
import type { AccessGroup } from "@/lib/access/access-types";
import { adminAccessPath } from "@/lib/admin/admin-routes";

export type AccessGroupKind = "tier" | "team";
export type NewAccessGroup = Omit<
  AccessGroup,
  "id" | "created_by" | "created_at" | "updated_at" | "is_default"
>;

/** `/admin/access/new?kind=…`: the create route a phone opens instead of the dialog. */
export const newAccessGroupPath = (kind: AccessGroupKind) =>
  `${adminAccessPath}/new?kind=${kind}`;

/**
 * Create a tier or team. The access page opens it as a dialog from `sm` up;
 * below that, and on a profile pinned to pages, it is the `/admin/access/new`
 * route. The form owns its own draft either way, so a cancelled dialog starts
 * fresh next time.
 */
export function CreateAccessGroupModal({
  kind,
  onCreate,
  onCreated,
  open = true,
  setOpen,
  presentation = "modal",
}: {
  kind: AccessGroupKind;
  onCreate: (input: NewAccessGroup) => Promise<AccessGroup>;
  onCreated: (group: AccessGroup) => void;
  open?: boolean;
  setOpen: (open: boolean) => void;
  presentation?: "modal" | "page";
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
  const [hierarchyRank, setHierarchyRank] = useState("0");
  const [grantsGlobalContent, setGrantsGlobalContent] = useState(false);
  const [guest, setGuest] = useState(false);
  const [calendarAccess, setCalendarAccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const reserved = isReservedAccessGroupName(name);

  function close() {
    if (saving) return;
    setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !color || reserved) return;
    setSaving(true);
    setError("");
    try {
      const group = await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        color,
        kind,
        hierarchy_rank: kind === "tier" ? Number(hierarchyRank) : null,
        grants_global_content: kind === "tier" && !guest && grantsGlobalContent,
        calendar_access: calendarAccess,
        guest: kind === "tier" && guest,
      });
      onCreated(group);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : `The ${kind} could not be created.`,
      );
    } finally {
      setSaving(false);
    }
  }

  const title = kind === "tier" ? "New tier" : "New team";
  const surface = {
    title,
    description:
      kind === "tier"
        ? "Everyone has exactly one tier. It sets what they reach by default."
        : "Teams add access for work that cuts across tiers.",
    size: "md" as const,
    open,
    closable: !saving,
    formId: `create-access-group-${kind}`,
    onSubmit: submit,
    actions: (
      <ModalActions
        confirmDisabled={!name.trim() || !color || reserved}
        confirmForm={`create-access-group-${kind}`}
        confirmLabel={kind === "tier" ? "Create tier" : "Create team"}
        onCancel={close}
        pending={saving}
        pendingLabel="Creating..."
      />
    ),
  };
  const fields = (
    <div className="space-y-4">
      <Input
        label={kind === "tier" ? "Tier name" : "Team name"}
        name="access-group-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={kind === "tier" ? "Contributor" : "Documentary Team"}
        disabled={saving}
        autoFocus
        required
        error={reserved}
        aria-describedby={reserved ? `access-group-name-reserved-${kind}` : undefined}
      />
      {reserved && (
        <p
          id={`access-group-name-reserved-${kind}`}
          className="-mt-2 text-sm text-red-700 dark:text-red-300"
        >
          “{name.trim()}” is the address of this form. Pick another name.
        </p>
      )}
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
              onChange={(event) => setGrantsGlobalContent(event.target.checked)}
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
                For people outside the organization. Members reach only what is
                granted to this tier or their teams, never work or pages open to
                the workspace, and inherit nothing from other tiers.
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
        id={`access-group-description-${kind}`}
        label="Description"
        name="access-group-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={3}
        placeholder="Who belongs here and why?"
        disabled={saving}
      />
      {error && <ErrorCallout>{error}</ErrorCallout>}
    </div>
  );

  return presentation === "page" ? (
    <EditorSurface
      {...surface}
      presentation="page"
      setOpen={setOpen}
      parents={[
        {
          href: adminAccessPath,
          title: "Access groups",
          icon: <FiUsers aria-hidden className="shrink-0" />,
        },
      ]}
      crumb={{ title, icon: <FiPlus aria-hidden className="shrink-0" /> }}
    >
      {fields}
    </EditorSurface>
  ) : (
    <EditorSurface {...surface} setOpen={setOpen}>
      {fields}
    </EditorSurface>
  );
}
