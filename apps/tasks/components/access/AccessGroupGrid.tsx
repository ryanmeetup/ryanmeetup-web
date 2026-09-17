import { Avatar, Button, Card, IconButton, Tooltip } from "@ryanmeetup/ui";
import {
  FiCalendar,
  FiEdit2,
  FiEye,
  FiFolder,
  FiGrid,
  FiTag,
  FiUsers,
} from "react-icons/fi";
import { accessGroupSlug } from "@/lib/access/access-groups";
import { accessPreviewHref } from "@/lib/access/access-preview";
import type { AccessGroupOverview } from "@/lib/access/access-overview";
import type { AccessGroup, GroupMember } from "@/lib/access/access-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import { AccessGroupKindBadge } from "./AccessGroupKindBadge";
import { adminAccessGroupPath } from "@/lib/admin/admin-routes";

/**
 * What a group reaches, as a list rather than a fixed field per capability.
 *
 * The card used to carry a single `Calendar: Yes/No` cell, which read as though
 * the Google feed were the only permission a group could hold - it was simply
 * the only one stored on the group row, while projects, categories, and pages
 * are all granted from the resource side. Listing the same three resource
 * kinds the group page explains keeps the card honest about the whole surface,
 * and the calendar feed appears as one entry among them, only when it is
 * actually granted.
 */
function AccessSummary({ overview }: { overview: AccessGroupOverview }) {
  const reach = [
    {
      key: "projects",
      icon: FiFolder,
      count: overview.projects.length,
      total: overview.projectCount,
      label: "projects",
    },
    {
      key: "categories",
      icon: FiTag,
      count: overview.categories.length,
      total: overview.categoryCount,
      label: "categories",
    },
    {
      key: "pages",
      icon: FiGrid,
      count: overview.pages.length,
      total: overview.pageCount,
      label: "pages",
    },
  ];
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
      {reach.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.key} className="flex items-center gap-1.5">
            <Icon aria-hidden className="shrink-0 opacity-55" />
            <span>
              <span className="font-semibold">
                {item.count} of {item.total}
              </span>{" "}
              <span className="text-black/65 dark:text-white/65">
                {item.label}
              </span>
            </span>
          </li>
        );
      })}
      {overview.calendarReason && (
        <li className="flex items-center gap-1.5">
          <FiCalendar aria-hidden className="shrink-0 opacity-55" />
          <span className="text-black/65 dark:text-white/65">
            Calendar feed
          </span>
        </li>
      )}
    </ul>
  );
}

export function AccessGroupGrid({
  groups,
  members,
  overviews,
  profiles,
}: {
  groups: AccessGroup[];
  members: GroupMember[];
  /** Effective access per group id, from `buildAccessGroupOverviews`. */
  overviews: Map<string, AccessGroupOverview>;
  profiles: Profile[];
}) {
  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );

  return (
    <>
      {groups.length === 0 && (
        <Card className="p-5 text-sm text-black/65 dark:text-white/65">
          No access groups yet.
        </Card>
      )}
      <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const groupMembers = members.filter(
            (item) => item.group_id === group.id,
          );
          const overview = overviews.get(group.id);
          return (
            <Card key={group.id} className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="flex min-w-0 items-center gap-2 text-lg leading-tight font-semibold">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="truncate">{group.name}</span>
                    <AccessGroupKindBadge kind={group.kind} />
                    {group.is_default && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        New-member default
                      </span>
                    )}
                  </h3>
                  <p className="mt-1 pb-4 text-sm text-black/65 dark:text-white/65">
                    {group.description || "No description yet."}
                  </p>
                </div>
                <IconButton.Link
                  href={adminAccessGroupPath(accessGroupSlug(group.name))}
                  label={`Manage ${group.name}`}
                  size="md"
                  variant="edit"
                >
                  <FiEdit2 />
                </IconButton.Link>
              </div>
              <div className="mt-auto space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
                    <FiUsers /> Members
                  </p>
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {groupMembers.slice(0, 3).map((member) => {
                        const profile = profilesById.get(member.profile_id);
                        return profile ? (
                          <Tooltip
                            key={profile.id}
                            content={profile.full_name}
                            placement="top"
                          >
                            <Avatar
                              name={profile.full_name}
                              src={profile.avatar_url}
                              size="sm"
                              className="ring-2 ring-white dark:ring-[#181818]"
                            />
                          </Tooltip>
                        ) : null;
                      })}
                    </div>
                    <span className="ml-2 text-sm font-semibold">
                      {groupMembers.length}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
                    Effective access
                  </p>
                  {overview ? (
                    <AccessSummary overview={overview} />
                  ) : (
                    <p className="mt-2 text-sm text-black/55 dark:text-white/55">
                      Open the group to see what it reaches.
                    </p>
                  )}
                </div>
              </div>
              <Button.Link
                href={accessPreviewHref(group.name)}
                variant="secondary"
                size="sm"
                leftIcon={<FiEye />}
                className="mt-4 w-full"
              >
                View as group
              </Button.Link>
            </Card>
          );
        })}
      </div>
    </>
  );
}
