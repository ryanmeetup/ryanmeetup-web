import type { Project } from "@/lib/resources/resource-types";
import { isCurrentProject } from "@/lib/resources/project-status";

export function currentFavoriteProjectIds(
  projects: Project[],
  favoriteProjectIds: string[],
) {
  const currentProjectIds = new Set(
    projects.filter(isCurrentProject).map((project) => project.id),
  );
  return favoriteProjectIds.filter((id) => currentProjectIds.has(id));
}

export function sortFavoriteProjectsFirst(
  projects: Project[],
  favoriteProjectIds: string[],
) {
  const favorites = new Set(
    currentFavoriteProjectIds(projects, favoriteProjectIds),
  );

  return projects
    .map((project, index) => ({ project, index }))
    .sort((left, right) => {
      const favoriteDifference =
        Number(favorites.has(right.project.id)) -
        Number(favorites.has(left.project.id));

      return favoriteDifference || left.index - right.index;
    })
    .map(({ project }) => project);
}
