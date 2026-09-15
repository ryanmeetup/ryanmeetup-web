import { describe, expect, it } from "vitest";
import {
  describeActivity,
  groupActivityByDate,
  resolveActivityRows,
} from "@/lib/activity/activity-presentation";
import type { TaskActivity } from "@/lib/activity/activity-types";
import type { Status } from "@/lib/tasks/task-types";

const activity = (
  id: string,
  created_at: string,
  details: Record<string, unknown> = {},
): TaskActivity =>
  ({
    id,
    task_id: "task",
    actor_id: null,
    action: "moved task",
    details,
    created_at,
  }) as TaskActivity;

describe("activity presentation", () => {
  it("resolves non-task resource labels and links", () => {
    const item = activity("resource", "2026-08-13T12:00:00Z", {
      resource_name: "Acme",
      resource_href: "/contacts",
    });
    item.task_id = null;
    const [row] = resolveActivityRows([item], {
      tasks: [],
      profiles: [],
      projects: [],
      categories: [],
      statuses: [],
    });
    expect(row).toMatchObject({
      resourceName: "Acme",
      resourceHref: "/contacts",
    });
  });

  it("names the attachment a resource attachment event was written for", () => {
    const item = activity("attachment", "2026-08-13T12:00:00Z", {
      resource_name: "Fall Launch",
      resource_href: "/projects",
      attachment_name: "brief.pdf",
    });
    item.task_id = null;
    item.action = "project.attachment.add";
    expect(describeActivity(item, [])).toEqual({
      kind: "text",
      label: "Project attachment added",
      detail: "brief.pdf",
    });
  });

  it("names the people an owner change added and removed", () => {
    const item = activity("owners", "2026-08-13T12:00:00Z", {
      resource_name: "Fall Launch",
      detail: "Added Sam; Removed Ryan",
    });
    item.task_id = null;
    item.action = "project.owners.update";
    expect(describeActivity(item, [])).toEqual({
      kind: "text",
      label: "Project owners changed",
      detail: "Added Sam; Removed Ryan",
    });
  });

  it("uses project status colors for recorded status changes", () => {
    const item = activity("project-status", "2026-08-13T12:00:00Z", {
      detail: "Status: Active → Complete",
    });
    item.action = "project.update";

    expect(describeActivity(item, [])).toEqual({
      kind: "project-status",
      from: { name: "Active", color: "#d97706" },
      to: { name: "Complete", color: "#059669" },
      detail: undefined,
    });

    item.details.detail = "Name: Old → New; Status: Complete → Active";
    expect(describeActivity(item, [])).toMatchObject({
      kind: "project-status",
      from: { name: "Complete", color: "#059669" },
      to: { name: "Active", color: "#d97706" },
      detail: "Name: Old → New",
    });
  });

  it("preserves unfamiliar project status details as text", () => {
    const item = activity("project-status", "2026-08-13T12:00:00Z", {
      detail: "Status: Custom → Complete",
    });
    item.action = "project.update";

    expect(describeActivity(item, [])).toEqual({
      kind: "text",
      label: "Project updated",
      detail: "Status: Custom → Complete",
    });
  });

  it("retains the category color for category activity", () => {
    const item = activity("category", "2026-08-13T12:00:00Z", {
      resource_id: "operations",
      resource_name: "Operations",
      resource_href: "/categories",
    });
    item.task_id = null;
    item.action = "category.update";
    const [row] = resolveActivityRows([item], {
      tasks: [],
      profiles: [],
      projects: [],
      categories: [
        { id: "operations", name: "Operations", color: "#f97316" },
      ] as never[],
      statuses: [],
    });
    expect(row?.category).toMatchObject({
      name: "Operations",
      color: "#f97316",
    });
  });

  it("describes moves with resolved statuses and falls back safely", () => {
    const statuses = [
      { id: "todo", name: "To do" },
      { id: "done", name: "Done" },
    ] as Status[];
    expect(
      describeActivity(
        activity("1", "2026-08-13T12:00:00Z", {
          from_status_id: "todo",
          status_id: "done",
        }),
        statuses,
      ),
    ).toMatchObject({
      kind: "status",
      from: { id: "todo" },
      to: { id: "done" },
    });
    expect(
      describeActivity(activity("2", "2026-08-13T12:00:00Z"), statuses),
    ).toEqual({ kind: "text", label: "Task moved" });
  });

  it("describes a task save by the fields it changed", () => {
    const item = activity("save", "2026-08-13T12:00:00Z", {
      changes: [{ field: "status", from: "todo", to: "done" }],
    });
    item.action = "updated the task";
    const statuses = [
      { id: "todo", name: "To do", color: "#888888" },
      { id: "done", name: "Done", color: "#16a34a" },
    ] as Status[];
    const [row] = resolveActivityRows([item], {
      tasks: [],
      profiles: [],
      projects: [],
      categories: [],
      statuses,
    });
    expect(row?.description).toMatchObject({
      kind: "changes",
      label: "Task updated",
    });
    expect(row?.changes).toMatchObject([
      { field: "status", from: "To do", to: "Done" },
    ]);
  });

  it("keeps a save without recorded changes on its generic label", () => {
    const item = activity("bare", "2026-08-13T12:00:00Z");
    item.action = "updated the task";
    const [row] = resolveActivityRows([item], {
      tasks: [],
      profiles: [],
      projects: [],
      categories: [],
      statuses: [],
    });
    expect(row?.description).toEqual({ kind: "text", label: "Task updated" });
  });

  it("groups rows on calendar dates in the requested timezone", () => {
    const rows = [
      { item: activity("1", "2026-08-14T01:00:00Z") },
      { item: activity("2", "2026-08-13T20:00:00Z") },
    ] as never[];
    const groups = groupActivityByDate(rows, "en-US", "America/New_York");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rows).toHaveLength(2);
  });
});
