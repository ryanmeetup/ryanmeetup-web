import type { Project, ProjectStatus } from "./resource-types";
import { filterAndSortResources } from "./resource-management";

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

export type ProjectListFilter = "current" | "closed" | "archived" | "all";

export function projectListFilter(value: string): ProjectListFilter {
  if (value === "closed" || value === "archived" || value === "all")
    return value;
  // Before Dropped existed, the closed view was "completed".
  if (value === "completed") return "closed";
  // Older shared links used "active" for all unarchived projects.
  return "current";
}

export function isCurrentProject(
  project: Pick<Project, "status" | "archived_at">,
) {
  return !project.archived_at && !isClosedProjectStatus(project.status);
}

export function filterProjects<
  T extends Pick<Project, "status" | "archived_at" | "name">,
>(projects: T[], filter: ProjectListFilter) {
  const visible = filterAndSortResources(
    projects,
    filter === "archived" || filter === "all" ? filter : "active",
  );
  if (filter === "current")
    return visible.filter(isCurrentProject);
  if (filter === "closed")
    return visible.filter((project) => isClosedProjectStatus(project.status));
  return visible;
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
