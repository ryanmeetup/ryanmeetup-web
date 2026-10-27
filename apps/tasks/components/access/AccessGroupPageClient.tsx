"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Breadcrumbs,
  Button,
  Card,
  ConfirmationDialog,
  DropdownSelect,
  Heading,
  Input,
  Textarea,
  Tooltip,
  toast,
} from "@ryanmeetup/ui";
import { FiShield, FiTrash2, FiUsers } from "react-icons/fi";
import {
  ACCESS_GROUP_COLOR_OPTIONS,
  accessGroupSlug,
} from "@/lib/access/access-groups";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { useAccessManagement } from "@/hooks/useAccessManagement";
import { AdminPageShell } from "@/components/admin";
import { CategoriesModal } from "@/components/categories";
import { categoryController } from "@/components/categories/category-workspace";
import { ProjectsModal } from "@/components/projects";
import { AccessGroupKindBadge } from "./AccessGroupKindBadge";
import { AccessGroupMembersPanel } from "./AccessGroupMembersPanel";
import { AccessGroupOverview } from "./AccessGroupOverview";
import type { AccessGroupOverview as AccessGroupOverviewModel } from "@/lib/access/access-overview";
import type { AccessGroup, GroupMember } from "@/lib/access/access-types";
import {
  adminAccessPath,
  adminAccessGroupPath,
} from "@/lib/admin/admin-routes";

export function AccessGroupPageClient({
  initialData,
  group: initialGroup,
  initialGroups,
  initialMembers,
  initialOverview,
}: {
  currentUserId: string;
  initialData: WorkspaceData;
  group: AccessGroup;
  initialGroups: AccessGroup[];
  initialMembers: GroupMember[];
  initialOverview: AccessGroupOverviewModel;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [group, setGroup] = useState(initialGroup);
  const access = useAccessManagement({
    initialGroups,
    initialMembers,
  });
  const { members } = access;
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [color, setColor] = useState(group.color);
  const [kind, setKind] = useState<"tier" | "team">(group.kind);
  const [hierarchyRank, setHierarchyRank] = useState(
    String(group.hierarchy_rank ?? 0),
  );
  const [grantsGlobalContent, setGrantsGlobalContent] = useState(
    group.grants_global_content,
  );
  const [calendarAccess, setCalendarAccess] = useState(group.calendar_access);
  const [guest, setGuest] = useState(group.guest);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);

  async function saveGroup(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const updated = await access.updateGroup(group.id, {
      name: name.trim(),
      description: description.trim() || null,
      color,
      kind,
      hierarchy_rank: kind === "tier" ? Number(hierarchyRank) : null,
      grants_global_content: kind === "tier" && !guest && grantsGlobalContent,
      calendar_access: calendarAccess,
      guest: kind === "tier" && guest,
    });
    setSaving(false);
    setGroup(updated);
    toast.success(`${updated.name} updated.`);
    router.refresh();
    const nextSlug = accessGroupSlug(updated.name);
    if (nextSlug !== accessGroupSlug(group.name))
      router.replace(adminAccessGroupPath(nextSlug));
  }

  async function deleteGroup() {
    await access.deleteGroup(group.id);
    router.push(adminAccessPath);
    router.refresh();
  }

  async function makeDefaultTier() {
    setSaving(true);
    try {
      const updated = await access.setDefaultTier(group.id);
      setGroup(updated);
      toast.success(`${updated.name} is now the default for new members.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The default tier could not be changed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminPageShell
        data={data}
        demoMode={false}
        nav={false}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onCreateCategory={() => setCategoryCreateOpen(true)}
        onCreateProject={() => setProjectCreateOpen(true)}
        setData={setData}
      >
        <Breadcrumbs
          variant="compact"
          crumbs={[
            {
              current: false,
              href: adminAccessPath,
              icon: <FiUsers aria-hidden className="shrink-0" />,
              title: "Access groups",
            },
            {
              current: true,
              href: adminAccessGroupPath(accessGroupSlug(group.name)),
              icon: <FiShield aria-hidden className="shrink-0" />,
              title: group.name,
            },
          ]}
        />
        <div>
          <Heading
            size="h1"
            className="flex flex-wrap items-center gap-3 text-3xl sm:text-4xl"
          >
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: group.color }}
            />
            <span>{group.name}</span>
            <AccessGroupKindBadge kind={group.kind} />
          </Heading>
        </div>
        <form onSubmit={saveGroup}>
          <Card className="p-5">
            <div className="space-y-4">
              <Input
                label="Group name"
                name="group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                disabled={saving}
              />
              <Textarea
                id="group-description"
                label="Description"
                name="group-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                disabled={saving}
              />
              <Tooltip
                content={
                  group.is_default
                    ? "Choose another default tier before changing this group type."
                    : "Remove all members before changing the group type."
                }
                disabled={members.length === 0 && !group.is_default}
                triggerClassName="w-full [&>*]:flex-1"
              >
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
                  disabled={saving || members.length > 0 || group.is_default}
                />
              </Tooltip>
              {kind === "tier" && (
                <>
                  <Input
                    label="Hierarchy rank"
                    name="group-hierarchy-rank"
                    type="number"
                    min="0"
                    value={hierarchyRank}
                    onChange={(event) => setHierarchyRank(event.target.value)}
                    disabled={saving}
                    required
                  />
                  <p className="text-sm text-black/65 dark:text-white/65">
                    Higher ranks inherit project and category grants from every
                    lower tier.
                  </p>
                  {group.is_default ? (
                    <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] p-3 text-sm text-emerald-800 dark:text-emerald-200">
                      This is the default tier assigned automatically to every
                      new member.
                    </p>
                  ) : group.guest ? null : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      disabled={saving}
                      onClick={() => void makeDefaultTier()}
                    >
                      Make default for new members
                    </Button>
                  )}
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={guest}
                      onChange={(event) => setGuest(event.target.checked)}
                      disabled={saving || group.is_default}
                    />
                    <span>
                      Guest tier
                      <span className="mt-1 block text-black/60 dark:text-white/60">
                        For people outside the organization. Members reach only
                        what is granted to this tier or their teams, never work
                        or pages open to the workspace, and inherit nothing from
                        other tiers.
                      </span>
                    </span>
                  </label>
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
                    <span>
                      Grant manager access to all current and future work
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
                options={ACCESS_GROUP_COLOR_OPTIONS.slice(1)}
                disabled={saving}
                required
              />
            </div>
            <div className="mt-5 flex flex-col gap-4 border-t border-black/10 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-black/70 dark:text-white/70">
                Group details and hierarchy settings save here. Membership
                changes save automatically.
              </p>
              <Button
                type="submit"
                className="w-full sm:w-auto sm:shrink-0"
                loading={saving}
                loadingText="Saving..."
              >
                Save details
              </Button>
            </div>
          </Card>
        </form>
        <div>
          <AccessGroupMembersPanel
            currentProfileId={data.currentProfile.id}
            group={group}
            members={members}
            profiles={data.profiles}
            onAdd={(profileId) =>
              access.setMember(group.id, profileId, group.kind === "tier")
            }
            onRemove={(profileId) => access.removeMember(group.id, profileId)}
          />
        </div>
        <AccessGroupOverview
          groupId={group.id}
          groupName={group.name}
          overview={initialOverview}
        />
        <Card className="flex flex-col items-start gap-4 border-red-500/25 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Delete access group</h2>
            <p className="mt-1 text-sm text-black/65 dark:text-white/65">
              Members relying on this group may immediately lose project access.
            </p>
          </div>
          <Button
            variant="danger"
            leftIcon={<FiTrash2 />}
            className="w-full sm:w-auto"
            disabled={group.is_default}
            title={
              group.is_default
                ? "Choose another default tier before deleting this one"
                : undefined
            }
            onClick={() => setDeleteOpen(true)}
          >
            Delete group
          </Button>
        </Card>
      </AdminPageShell>
      {projectCreateOpen && (
        <ProjectsModal
          modal={{ open: true, setOpen: setProjectCreateOpen }}
          workspace={{ data, setData, demoMode: false }}
          options={{ createOnly: true }}
        />
      )}
      {categoryCreateOpen && (
        <CategoriesModal
          modal={{ open: true, setOpen: setCategoryCreateOpen }}
          controller={categoryController(data, setData, false)}
          options={{ createOnly: true }}
        />
      )}
      <ConfirmationDialog
        open={deleteOpen}
        setOpen={setDeleteOpen}
        title="Delete Access Group?"
        description={`This removes ${group.name} and every project grant attached to it.`}
        confirmLabel="Delete group"
        destructive
        onConfirm={deleteGroup}
      />
    </>
  );
}
