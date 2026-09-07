import { profileDisplayName, splitCommaSeparated } from "@/lib/presentation";
import type { Project } from "@/lib/resources/resource-types";
import type { Status } from "@/lib/tasks/task-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import {
  MOVE_DIRECTIONS,
  moveFilterValue,
  parseMoveFilter,
  resolveMoveTarget,
} from "./activity-moves";

export type ActivityFilters = {
  projects: string;
  excludeProjects: string;
  people: string;
  excludePeople: string;
  events: string;
  excludeEvents: string;
  moves: string;
  excludeMoves: string;
  when: string;
};

function resolveList(value: string, resolve: (value: string) => string) {
  return splitCommaSeparated(value).map(resolve).join(",");
}

export function activityFilterCount(filters: ActivityFilters) {
  return (
    [
      filters.projects,
      filters.excludeProjects,
      filters.people,
      filters.excludePeople,
      filters.events,
      filters.excludeEvents,
      filters.moves,
      filters.excludeMoves,
    ].reduce((total, value) => total + splitCommaSeparated(value).length, 0) +
    (filters.when === "all" ? 0 : 1)
  );
}

export function buildActivityQuery(
  filters: ActivityFilters,
  projects: Project[],
  profiles: Profile[],
  statuses: Status[] = [],
) {
  const params = new URLSearchParams();
  const projectIds = (value: string) =>
    resolveList(value, (item) =>
      item === "none"
        ? item
        : (projects.find(
            (project) => project.id === item || project.name === item,
          )?.id ?? item),
    );
  const personIds = (value: string) =>
    resolveList(value, (item) =>
      item === "system"
        ? item
        : (profiles.find(
            (profile) =>
              profile.id === item || profileDisplayName(profile) === item,
          )?.id ?? item),
    );
  // "Any done status" and a status name both stand for a set of status ids,
  // so the sets are expanded here rather than at the feed, which would then
  // need to read the status list back to understand the request.
  const moveIds = (value: string) => {
    const filter = parseMoveFilter(splitCommaSeparated(value));
    const entries = MOVE_DIRECTIONS.flatMap((direction) =>
      filter[direction].flatMap((target) =>
        resolveMoveTarget(target, statuses).map((statusId) =>
          moveFilterValue(direction, statusId),
        ),
      ),
    );
    // Picking both "Any done status" and Done resolves to the same entry
    // twice, which reads as two filters at the feed and is one.
    return [...new Set(entries)].join(",");
  };
  const values: [string, string][] = [
    ["projects", projectIds(filters.projects)],
    ["excludeProjects", projectIds(filters.excludeProjects)],
    ["people", personIds(filters.people)],
    ["excludePeople", personIds(filters.excludePeople)],
    ["events", filters.events],
    ["excludeEvents", filters.excludeEvents],
    ["moves", moveIds(filters.moves)],
    ["excludeMoves", moveIds(filters.excludeMoves)],
  ];
  for (const [key, value] of values) if (value) params.set(key, value);
  if (filters.when !== "all") params.set("when", filters.when);
  return params;
}
