import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityRows } from "@/components/activity/ActivityRows";
import { TaskActivityPanel } from "@/components/tasks/TaskActivityPanel";
import type {
  ActivityDescription,
  ActivityPresentationRow,
} from "@/lib/activity/activity-presentation";
import type { TaskActivity } from "@/lib/activity/activity-types";

const staleItem = {
  id: "stale-event",
  task_id: "stale-task",
  actor_id: null,
  action: "left a stale note",
  details: {},
  created_at: "2026-09-01T12:00:00.000Z",
} as unknown as TaskActivity;

const staleRow: ActivityPresentationRow = {
  item: staleItem,
  actorName: "Stale Actor",
  resourceName: "A stale item",
  changes: [],
  description: {
    kind: "label",
    label: "A stale event",
  } as unknown as ActivityDescription,
};

function renderRows(loading: boolean, showProject = true) {
  return renderToStaticMarkup(
    createElement(ActivityRows, {
      emptyMessage: "No activity yet.",
      loading,
      rows: [staleRow],
      showProject,
    }),
  );
}

function firstSkeletonRowCells(markup: string) {
  const start = markup.indexOf('<tr aria-hidden="true" data-activity-skeleton=""');
  const row = markup.slice(start, markup.indexOf("</tr>", start));
  return row.match(/<td/g)?.length;
}

describe("activity feed loading", () => {
  it("replaces stale rows with ten placeholders in each layout", () => {
    const markup = renderRows(true);

    expect(markup).not.toContain(staleRow.actorName);
    expect(markup).not.toContain("No activity yet.");
    expect(markup.match(/data-activity-skeleton=""/g)).toHaveLength(20);
    expect(
      markup.match(/data-activity-skeleton="" class="h-14"/g),
    ).toHaveLength(10);
    expect(markup).toContain('role="status">Loading activity</span>');
    expect(markup).toContain('aria-busy="true"');
  });

  it.each([
    [true, 5],
    [false, 4],
  ])("fills every column when showProject is %s", (showProject, cells) => {
    expect(firstSkeletonRowCells(renderRows(true, showProject))).toBe(cells);
  });

  it("shows the rows once loaded", () => {
    const markup = renderRows(false);

    expect(markup).toContain(staleRow.actorName);
    expect(markup).not.toContain("data-activity-skeleton");
    expect(markup).not.toContain('role="status"');
  });
});

describe("task history loading", () => {
  function renderPanel(loading: boolean, loadingFirstPage: boolean) {
    return renderToStaticMarkup(
      createElement(TaskActivityPanel, {
        activity: [staleItem],
        hasMore: true,
        loading,
        loadingFirstPage,
        lookups: { categories: [], profiles: [], projects: [], statuses: [] },
        onLoadMore: () => {},
        pageLayout: true,
      }),
    );
  }

  it("replaces cached entries with placeholders while the first page loads", () => {
    const markup = renderPanel(true, true);

    expect(markup).not.toContain(staleItem.action);
    expect(markup.match(/data-task-activity-skeleton=""/g)).toHaveLength(3);
    expect(markup).toContain('role="status">Loading task history</span>');
  });

  it("keeps the history visible while older activity loads", () => {
    const markup = renderPanel(true, false);

    expect(markup).toContain(staleItem.action);
    expect(markup).not.toContain("data-task-activity-skeleton");
    expect(markup).toContain('aria-busy="true"');
  });
});
