import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskListView } from "@/components/tasks/TaskListView";
import type { Task } from "@/lib/tasks/task-types";

const staleTask = {
  id: "stale-task",
  title: "A stale task title",
  status_id: "",
  project_id: null,
} as Task;

function renderLoadingList(pageSize: number) {
  return renderToStaticMarkup(
    createElement(TaskListView, {
      data: {
        assigneesByTask: new Map(),
        categories: new Map(),
        categoriesByTask: new Map(),
        profiles: new Map(),
        projects: new Map(),
        statuses: [],
        tasks: [staleTask],
      },
      loading: true,
      archived: true,
      onOpenTask: () => {},
      pagination: {
        page: 1,
        pageSize,
        totalCount: 1,
        onPageChange: () => {},
        onPageSizeChange: () => {},
      },
      sorting: {
        value: "closed",
        onChange: () => {},
        onToggle: () => {},
      },
    }),
  );
}

describe("task list loading", () => {
  it.each([5, 25, 100])(
    "shows ten fixed-height placeholders instead of stale rows at page size %i",
    (pageSize) => {
      const markup = renderLoadingList(pageSize);

      expect(markup).not.toContain(staleTask.title);
      expect(markup.match(/data-task-list-skeleton=""/g)).toHaveLength(20);
      expect(markup.match(/data-task-list-skeleton="" class="h-14"/g)).toHaveLength(10);
      expect(markup.match(/data-task-list-skeleton="" class="h-24 p-4"/g)).toHaveLength(10);
      expect(markup).toContain('role="status">Loading tasks</span>');
      expect(markup).toContain('aria-busy="true"');
    },
  );
});
