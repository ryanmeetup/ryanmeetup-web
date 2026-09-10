import { describe, expect, it } from "vitest";
import {
  demoContacts,
  demoData,
  demoNoteComments,
  demoNotes,
} from "@/lib/workspace/demo-data";
import { demoTaskDrafts } from "@/lib/workspace/demo-drafts";
import { defaultStatuses } from "@/lib/workspace/default-statuses";

describe("demo workspace", () => {
  it("uses neutral first-run content", () => {
    expect(
      JSON.stringify([demoData, demoNotes, demoNoteComments, demoContacts]),
    ).not.toMatch(/ryan meetup|ryancon/i);
    expect(demoData.currentProfile.full_name).toBe("Taylor Brooks");
    expect(demoData.projects.map((project) => project.name)).toEqual([
      "Website Refresh",
      "Fall Launch",
    ]);
  });

  it("uses the complete default workspace board", () => {
    expect(demoData.statuses).toHaveLength(defaultStatuses.length);
    defaultStatuses.forEach((status, index) => {
      expect(demoData.statuses[index]).toMatchObject(status);
    });
  });

  it("keeps fixture relationships connected", () => {
    const profileIds = new Set(demoData.profiles.map((profile) => profile.id));
    const projectIds = new Set(demoData.projects.map((project) => project.id));
    const categoryIds = new Set(
      demoData.categories.map((category) => category.id),
    );
    const assignedProfileIds = new Set(
      demoData.taskAssignees.map((assignment) => assignment.profile_id),
    );

    expect(profileIds).toContain(demoData.currentProfile.id);
    expect(
      demoData.tasks.every(
        (task) =>
          profileIds.has(task.created_by) &&
          profileIds.has(task.reported_by) &&
          (!task.project_id || projectIds.has(task.project_id)),
      ),
    ).toBe(true);
    expect(
      [...assignedProfileIds].every((profileId) => profileIds.has(profileId)),
    ).toBe(true);
    expect(
      demoData.taskCategories.every((assignment) =>
        categoryIds.has(assignment.category_id),
      ),
    ).toBe(true);
  });

  it("fills the dashboard widgets that read live dates", () => {
    const now = Date.now();
    const completed = new Set(
      demoData.statuses
        .filter((status) => status.outcome === "delivered")
        .map((status) => status.id),
    );
    const upcoming = demoData.tasks.filter((task) => {
      if (!task.due_date || completed.has(task.status_id)) return false;
      const due = new Date(`${task.due_date}T23:59:59`).getTime();
      return (
        demoData.taskAssignees.some(
          (assignment) =>
            assignment.task_id === task.id &&
            assignment.profile_id === demoData.currentProfile.id,
        ) &&
        due >= now &&
        due <= now + 14 * 24 * 60 * 60 * 1000
      );
    });
    const relevant = new Set(
      demoData.tasks
        .filter(
          (task) =>
            demoData.taskAssignees.some(
              (assignment) =>
                assignment.task_id === task.id &&
                assignment.profile_id === demoData.currentProfile.id,
            ) ||
            task.reported_by === demoData.currentProfile.id,
        )
        .map((task) => task.id),
    );
    const statusChanges = demoData.activity.filter(
      (item) =>
        item.action === "moved task" &&
        item.task_id &&
        relevant.has(item.task_id),
    );

    // Each widget pages five at a time, so more than one page proves the
    // pagination controls have something to do.
    expect(upcoming.length).toBeGreaterThan(5);
    expect(statusChanges.length).toBeGreaterThan(5);
    expect(demoTaskDrafts.length).toBeGreaterThan(0);
  });

  it("points notes, comments, and contacts at real fixtures", () => {
    const categoryIds = new Set(
      demoData.categories.map((category) => category.id),
    );
    const noteIds = new Set(demoNotes.map((note) => note.id));
    const profileIds = new Set(demoData.profiles.map((profile) => profile.id));
    const taskIds = new Set(demoData.tasks.map((task) => task.id));

    expect(demoNotes.some((note) => note.archived_at)).toBe(true);
    expect(
      demoNotes.every(
        (note) =>
          profileIds.has(note.created_by) &&
          (!note.category_id || categoryIds.has(note.category_id)) &&
          (!note.converted_task_id || taskIds.has(note.converted_task_id)),
      ),
    ).toBe(true);
    expect(
      demoNoteComments.every(
        (comment) =>
          noteIds.has(comment.note_id) && profileIds.has(comment.created_by),
      ),
    ).toBe(true);
    expect(demoContacts.every((contact) => contact.people.length > 0)).toBe(
      true,
    );
  });

  it("keeps demo activity anchored to tasks and actors", () => {
    const profileIds = new Set(demoData.profiles.map((profile) => profile.id));
    const taskIds = new Set(demoData.tasks.map((task) => task.id));
    const statusIds = new Set(demoData.statuses.map((status) => status.id));

    expect(
      demoData.activity.every(
        (item) =>
          (!item.task_id || taskIds.has(item.task_id)) &&
          (!item.actor_id || profileIds.has(item.actor_id)) &&
          (item.action !== "moved task" ||
            (statusIds.has(String(item.details.from_status_id)) &&
              statusIds.has(String(item.details.status_id)))),
      ),
    ).toBe(true);
  });
});
