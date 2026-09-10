import { describe, expect, it } from "vitest";
import type { Category, Project } from "@/lib/resources/resource-types";
import type { Status, Task } from "@/lib/tasks/task-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import {
  findRelatedTaskSearchResults,
  firstRelatedTaskSearchHref,
  orderTaskSearchGroups,
  partitionArchivedTasks,
  rankTaskSearchResults,
  taskSearchAllHref,
  taskSearchFilterHref,
  taskSearchProjectHref,
  taskSearchResultHref,
} from "@/lib/tasks/task-search";

const task = (
  id: string,
  task_number: number,
  title: string,
  extra: Partial<Task> = {},
) =>
  ({
    id,
    task_number,
    title,
    description: null,
    project_id: null,
    ...extra,
  }) as Task;

describe("task search", () => {
  it("separates work that has left the board from work still on it", () => {
    const clock = Date.parse("2026-09-10T12:00:00Z");
    const tasks = [
      task("open", 1, "Alpha"),
      task("archived", 2, "Alpha", {
        archived_at: "2026-09-01T12:00:00Z",
        completed_at: "2026-08-18T12:00:00Z",
      }),
      // Finished, but still inside its grace period: it is on the board.
      task("closing", 3, "Alpha", {
        archived_at: "2026-09-20T12:00:00Z",
        completed_at: "2026-09-06T12:00:00Z",
      }),
    ];

    const { active, archived } = partitionArchivedTasks(tasks, clock);

    expect(active.map((item) => item.id)).toEqual(["open", "closing"]);
    expect(archived.map((item) => item.id)).toEqual(["archived"]);
  });

  it("normalizes, ranks, tie-breaks, and limits task matches", () => {
    const tasks = [
      task("description", 4, "Elsewhere", { description: "Alpha detail" }),
      task("contains", 9, "An alpha task"),
      task("prefix-old", 2, "Alpha first"),
      task("prefix-new", 8, "Alpha second"),
      task("exact", 1, "ALPHA"),
      task("project", 5, "Elsewhere", { project_id: "project-1" }),
    ];

    expect(
      rankTaskSearchResults({
        tasks,
        query: "  alpha ",
        projectNames: new Map([["project-1", "Alpha program"]]),
        limit: 5,
      }).map(({ id }) => id),
    ).toEqual(["exact", "prefix-new", "prefix-old", "contains", "project"]);
  });

  it("gives exact task keys precedence and ignores short queries", () => {
    const tasks = [
      task("title", 1, "TASK-42 plan"),
      task("key", 42, "Unrelated"),
    ];
    expect(rankTaskSearchResults({ tasks, query: "task-42" })[0]?.id).toBe(
      "key",
    );
    expect(rankTaskSearchResults({ tasks, query: "rm" })).toEqual([]);
  });

  it("groups active related objects by the smallest result set first", () => {
    const project = {
      id: "p",
      name: "Alpha",
      description: null,
      archived_at: null,
    } as Project;
    const category = {
      id: "c",
      name: "Alpha",
      description: null,
      archived_at: null,
    } as Category;
    const profile = { id: "u", full_name: "Alpha Person" } as Profile;
    const status = { id: "s", name: "Alpha" } as Status;
    const related = findRelatedTaskSearchResults({
      query: "alpha",
      projects: [project],
      categories: [category],
      profiles: [profile],
      statuses: [status],
    });
    expect(related).toEqual({
      projects: [project],
      categories: [category],
      profiles: [profile],
      statuses: [status],
    });
    expect([...orderTaskSearchGroups(related, 3).keys()]).toEqual([
      "projects",
      "categories",
      "profiles",
      "statuses",
      "issues",
    ]);
  });

  it("builds task, all-results, filter, and fallback navigation targets", () => {
    const preview = { accessPreview: "group one" };
    expect(taskSearchResultHref(task("x", 42, "Task"), preview)).toBe(
      "/task/TASK-42?accessPreview=group+one",
    );
    expect(taskSearchAllHref("alpha beta", preview)).toBe(
      "/board?view=list&q=alpha+beta&accessPreview=group+one",
    );
    expect(taskSearchFilterHref("project", "Big launch", preview)).toBe(
      "/board?project=Big+launch&accessPreview=group+one",
    );
    const project = { id: "p", name: "Big launch" } as Project;
    expect(taskSearchProjectHref(project, [project], preview)).toBe(
      "/projects/big-launch?accessPreview=group+one",
    );
    expect(
      firstRelatedTaskSearchHref(
        {
          projects: [],
          categories: [],
          profiles: [],
          statuses: [{ name: "Doing" } as Status],
        },
        preview,
      ),
    ).toBe("/board?status=Doing&accessPreview=group+one");
  });
});
