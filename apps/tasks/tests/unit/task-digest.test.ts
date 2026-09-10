import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTaskDigest,
  taskDigestCount,
  type DigestTask,
} from "@/lib/tasks/task-digest";
import {
  renderTaskDigestEmail,
  sendTaskDigestEmail,
  timeOfDay,
} from "@/lib/server/task-digest-email";
import {
  digestDefaults,
  type DigestSectionKey,
} from "@/lib/digest/digest-settings";

/** The digest is an ordered list; tests read it by key. */
const sectionTasks = (
  digest: ReturnType<typeof buildTaskDigest>,
  key: DigestSectionKey,
) => digest.find((section) => section.key === key)?.tasks ?? [];

const onlySection = (key: DigestSectionKey, tasks: DigestTask[]) => [
  { key, tasks },
];

const task = (
  values: Partial<DigestTask> &
    Pick<DigestTask, "id" | "task_number" | "title">,
): DigestTask => ({
  due_date: null,
  due_time: null,
  description: null,
  priority: "medium",
  updated_at: "2026-08-01T12:00:00.000Z",
  ...values,
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("task workload digests", () => {
  it("uses the recipient workspace time for greetings", () => {
    expect(timeOfDay(new Date("2026-08-20T13:00:00.000Z"))).toBe("morning");
    expect(timeOfDay(new Date("2026-08-20T20:30:00.000Z"))).toBe("afternoon");
    expect(timeOfDay(new Date("2026-08-20T23:00:00.000Z"))).toBe("evening");
  });

  it("groups each actionable task into one section", () => {
    const digest = buildTaskDigest(
      [
        task({
          id: "1",
          task_number: 1,
          title: "Late",
          due_date: "2026-08-19",
        }),
        task({
          id: "2",
          task_number: 2,
          title: "Today",
          due_date: "2026-08-20",
        }),
        task({
          id: "3",
          task_number: 3,
          title: "Soon",
          due_date: "2026-08-23",
        }),
        task({ id: "4", task_number: 4, title: "Urgent", priority: "urgent" }),
        task({
          id: "5",
          task_number: 5,
          title: "Later",
          due_date: "2026-08-24",
        }),
      ],
      "2026-08-20",
      digestDefaults,
      new Date("2026-08-20T12:00:00.000Z"),
    );

    expect(sectionTasks(digest, "overdue").map((item) => item.id)).toEqual([
      "1",
    ]);
    expect(sectionTasks(digest, "dueToday").map((item) => item.id)).toEqual([
      "2",
    ]);
    expect(sectionTasks(digest, "upcoming").map((item) => item.id)).toEqual([
      "3",
    ]);
    expect(sectionTasks(digest, "highPriority").map((item) => item.id)).toEqual(
      ["4"],
    );
    expect(taskDigestCount(digest)).toBe(4);
  });

  it("surfaces recent updates without double-counting tasks", () => {
    const digest = buildTaskDigest(
      [
        task({
          id: "1",
          task_number: 1,
          title: "Changed today",
          due_date: "2026-08-20",
          updated_at: "2026-08-20T10:00:00.000Z",
        }),
      ],
      "2026-08-20",
      digestDefaults,
      new Date("2026-08-20T12:00:00.000Z"),
    );

    expect(sectionTasks(digest, "dueToday")).toHaveLength(1);
    expect(sectionTasks(digest, "recentlyUpdated")).toHaveLength(1);
    expect(taskDigestCount(digest)).toBe(1);
  });

  it("renders app-like task cards with icon-led sections and spaced metadata", () => {
    vi.stubEnv("TASKS_APP_URL", "https://tasks.ryanmeetup.com");
    const item = task({
      id: "1",
      task_number: 53,
      title: "Fix high CPU usage on Supabase",
      priority: "urgent",
      due_date: "2026-08-20",
      project: { name: "tasks.ryanmeetup.com" },
      status: { name: "Backlog", color: "#64748b" },
    });
    const html = renderTaskDigestEmail(
      onlySection("overdue", [item]),
      "Ryan",
      new Date("2026-08-20T13:00:00.000Z"),
    );

    expect(html).toContain("background:#e7e9e8");
    expect(html).toContain("background:#fee2e2");
    expect(html).toContain("TASK-53");
    expect(html).toContain("📁&nbsp; tasks.ryanmeetup.com");
    expect(html).toContain("📅&nbsp; Due Aug 20");
    expect(html).toContain(
      '<td align="right" style="color:#374151;font-weight:750;white-space:nowrap">View task&nbsp; →</td>',
    );
    expect(html).not.toContain("float:right");
    expect(html).not.toContain("&nbsp; · &nbsp;");
  });

  it("submits digests to Resend with a scheduled review window", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("TASK_DIGEST_FROM_EMAIL", "Tasks <tasks@example.com>");
    vi.stubEnv("TASKS_APP_URL", "https://tasks.ryanmeetup.com");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "email-1" })));
    vi.stubGlobal("fetch", fetchMock);
    const scheduledAt = "2026-08-21T13:30:00.000Z";

    await sendTaskDigestEmail({
      digest: onlySection("overdue", [
        task({ id: "1", task_number: 1, title: "Review me" }),
      ]),
      digestDate: "2026-08-21",
      profileId: "profile-1",
      recipientName: "Ryan",
      to: "ryan@example.com",
      scheduledAt,
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(request.body as string)).toMatchObject({
      to: ["ryan@example.com"],
      scheduled_at: scheduledAt,
    });
  });
});
