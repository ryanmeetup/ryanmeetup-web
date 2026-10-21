import type { IconType } from "react-icons";
import { FiCalendar, FiCheckSquare, FiFileText, FiUsers } from "react-icons/fi";

/**
 * The pages an app owner can lock behind access groups.
 *
 * This registry, not the database, owns the set. `workspace_area_access` holds
 * a row only for a page an owner has actually configured. Unconfigured pages
 * are open except RY-D, which requires explicit access metadata. Adding a
 * lockable page is an entry here plus the matching
 * RLS predicate — never a schema change to a table of pages.
 *
 * `key` is the value written to the database and passed to
 * `can_view_workspace_area`; it must stay stable once a workspace has used it.
 * The icon is the one the page's sidebar entry already leads with.
 */
export const WORKSPACE_AREAS = [
  {
    key: "notes",
    label: "Notes",
    href: "/notes",
    icon: FiFileText,
    description: "Scratch notes and the comments on them.",
  },
  {
    key: "contacts",
    label: "Contacts",
    href: "/contacts",
    icon: FiUsers,
    description: "The shared directory of organizations and their people.",
  },
  {
    key: "calendar",
    label: "Calendar",
    href: "/calendar",
    icon: FiCalendar,
    description:
      "Important dates, time away, and the Google feed for groups that can see it.",
  },
  {
    key: "ryd",
    label: "RY-D Verification",
    href: "/ryd",
    icon: FiCheckSquare,
    description:
      "RY-D orders, the identity evidence buyers sent, and what goes back to fulfillment.",
    // Only an instance that sells RY-Ds has this page. See `rydEnabled`.
    instanceFlag: "rydEnabled",
  },
] as const satisfies readonly {
  key: string;
  label: string;
  href: string;
  icon: IconType;
  description: string;
  instanceFlag?: "rydEnabled";
}[];

export type WorkspaceArea = (typeof WORKSPACE_AREAS)[number];
export type WorkspaceAreaKey = WorkspaceArea["key"];

export const WORKSPACE_AREA_KEYS: readonly WorkspaceAreaKey[] =
  WORKSPACE_AREAS.map((area) => area.key);

/**
 * The pages this instance has. A page behind an instance flag that is off is
 * not merely closed: it is absent from the sidebar and the access settings.
 */
export function enabledWorkspaceAreas(flags: { rydEnabled: boolean }) {
  return WORKSPACE_AREAS.filter(
    (area) => !("instanceFlag" in area) || flags[area.instanceFlag],
  );
}

export function isWorkspaceAreaKey(value: unknown): value is WorkspaceAreaKey {
  return (
    typeof value === "string" &&
    WORKSPACE_AREA_KEYS.includes(value as WorkspaceAreaKey)
  );
}

export function workspaceAreaLabel(key: WorkspaceAreaKey) {
  return WORKSPACE_AREAS.find((area) => area.key === key)?.label ?? key;
}

/**
 * Whether a member reaches a page.
 *
 * `accessibleAreas` is absent only where the workspace has no server behind it
 * — demo mode — and there every page is open. Anywhere else the list is the
 * answer the database gave, and a page missing from it is closed. This decides
 * what the UI offers; RLS decides what the data does.
 */
export function canViewWorkspaceArea(
  accessibleAreas: readonly WorkspaceAreaKey[] | undefined,
  key: WorkspaceAreaKey,
) {
  return !accessibleAreas || accessibleAreas.includes(key);
}
