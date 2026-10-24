import type { Project, ProjectStatus } from "./resource-types";

export const projectStatusOptions: {
  color: string;
  label: string;
  value: ProjectStatus;
}[] = [
  { label: "Discovery", value: "discovery", color: "#7c3aed" },
  { label: "Queued", value: "queued", color: "#2563eb" },
  { label: "Active", value: "active", color: "#d97706" },
  { label: "Complete", value: "complete", color: "#059669" },
  { label: "Paused", value: "paused", color: "#64748b" },
  { label: "Dropped", value: "dropped", color: "#e11d48" },
];

export const defaultProjectStatus: ProjectStatus = "discovery";

// The form lists statuses in the order a project moves through them; the
// projects page leads with the work that wants attention now.
export const projectStatusSectionOrder: ProjectStatus[] = [
  "active",
  "queued",
  "discovery",
  "paused",
  "complete",
  "dropped",
];

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return projectStatusOptions.some((option) => option.value === value);
}

export function projectStatusDetails(status: ProjectStatus) {
  return (
    projectStatusOptions.find((option) => option.value === status) ??
    projectStatusOptions.find(
      (option) => option.value === defaultProjectStatus,
    )!
  );
}

/** Complete and Dropped both end a project; only Complete means it shipped. */
export function isClosedProjectStatus(status: ProjectStatus) {
  return status === "complete" || status === "dropped";
}

/**
 * The close time a project carries after moving to `status`, matching the
 * database's `set_project_closed_at` trigger so local state agrees with it.
 */
export function projectClosedAt(
  project: Pick<Project, "status" | "closed_at"> | null,
  status: ProjectStatus,
  now = new Date(),
) {
  if (!isClosedProjectStatus(status)) return null;
  if (project && isClosedProjectStatus(project.status))
    return project.closed_at ?? now.toISOString();
  return now.toISOString();
}

export type ProjectListFilter = "current" | "closed" | "all";

export function projectListFilter(value: string): ProjectListFilter {
  if (value === "closed" || value === "all") return value;
  // Before Dropped existed, the closed view was "completed"; before closing
  // replaced archiving, archived projects had a view of their own.
  if (value === "completed" || value === "archived") return "closed";
  // Older shared links used "active" for all open projects.
  return "current";
}

export function isCurrentProject(project: Pick<Project, "status">) {
  return !isClosedProjectStatus(project.status);
}

export function filterProjects<
  T extends Pick<Project, "status" | "name">,
>(projects: T[], filter: ProjectListFilter) {
  const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));
  if (filter === "all") return sorted;
  const closed = filter === "closed";
  return sorted.filter(
    (project) => isClosedProjectStatus(project.status) === closed,
  );
}

export function groupProjectsByStatus<T extends { status: ProjectStatus }>(
  projects: T[],
) {
  return projectStatusSectionOrder
    .map((status) => ({
      ...projectStatusDetails(status),
      projects: projects.filter((project) => project.status === status),
    }))
    .filter((group) => group.projects.length > 0);
}
