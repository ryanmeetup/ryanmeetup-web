import { tasksAppUrl } from "@/lib/app-url";
import { instanceDefaults, type InstanceSettings } from "@/lib/instance";
import { taskKey, taskPath } from "@/lib/tasks/task-key";
import type { DigestTask, TaskDigest } from "@/lib/tasks/task-digest";
import { taskDigestCount } from "@/lib/tasks/task-digest";
import {
  DIGEST_SECTION_META,
  digestDefaults,
  type DigestSectionKey,
} from "@/lib/digest/digest-settings";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function displayUpdatedAt(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function priorityStyle(priority: DigestTask["priority"]) {
  if (priority === "urgent")
    return "border-color:#fecaca;background:#fef2f2;color:#b91c1c";
  if (priority === "high")
    return "border-color:#fde68a;background:#fffbeb;color:#92400e";
  if (priority === "medium")
    return "border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8";
  return "border-color:#cbd5e1;background:#f1f5f9;color:#334155";
}

function taskRow(task: DigestTask, recent: boolean, timeZone: string) {
  const url = escapeHtml(tasksAppUrl(taskPath(task)));
  const description = task.description
    ?.replace(/[#_*`>\[\]()~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const metadata = [
    task.status
      ? `<span style="display:inline-block;margin:10px 14px 0 0;white-space:nowrap"><span style="color:${escapeHtml(task.status.color)}">●</span>&nbsp; ${escapeHtml(task.status.name)}</span>`
      : "",
    task.project
      ? `<span style="display:inline-block;margin:10px 14px 0 0;white-space:nowrap">📁&nbsp; ${escapeHtml(task.project.name)}</span>`
      : "",
    task.due_date
      ? `<span style="display:inline-block;margin:10px 14px 0 0;white-space:nowrap">📅&nbsp; Due ${displayDate(task.due_date)}${task.due_time ? ` at ${escapeHtml(task.due_time.slice(0, 5))}` : ""}</span>`
      : "",
    recent
      ? `<span style="display:inline-block;margin:10px 14px 0 0;white-space:nowrap">✨&nbsp; Updated ${displayUpdatedAt(task.updated_at, timeZone)}</span>`
      : "",
  ].filter(Boolean);
  return `<tr><td style="padding:0 0 14px"><a href="${url}" style="display:block;text-decoration:none;color:#111827;background:#ffffff;border:1px solid #d7dadc;border-radius:16px;padding:20px;box-shadow:0 2px 5px rgba(17,24,39,.08)"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="middle"><span style="display:inline-block;border:1px solid #c9cdd1;border-radius:7px;padding:5px 9px;color:#62676d;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;font-weight:800;line-height:1;letter-spacing:.08em">${escapeHtml(taskKey(task))}</span></td><td valign="middle" align="right"><span style="display:inline-block;border:1px solid;border-radius:999px;padding:5px 10px;font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;${priorityStyle(task.priority)}">${escapeHtml(task.priority)}</span></td></tr></table><div style="margin-top:14px;font-size:18px;font-weight:750;line-height:1.4;color:#111827">${escapeHtml(task.title)}</div>${description ? `<p style="margin:10px 0 0;color:#5f6368;font-size:13px;line-height:1.65">${escapeHtml(description)}${task.description!.length > 180 ? "…" : ""}</p>` : ""}<div style="margin-top:16px;padding-top:6px;border-top:1px solid #e5e7eb;color:#555b63;font-size:12px;font-weight:650;line-height:1.8">${metadata.join("")}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px"><tr><td align="right" style="color:#374151;font-weight:750;white-space:nowrap">View task&nbsp; →</td></tr></table></div></a></td></tr>`;
}

function section({ key, tasks }: TaskDigest[number], timeZone: string) {
  const meta = DIGEST_SECTION_META[key];
  const recent = key === "recentlyUpdated";
  return `<tr><td style="padding:18px 28px 2px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:14px"><tr><td valign="top" width="48"><span style="display:block;width:38px;height:38px;border-radius:10px;background:${meta.iconBackground};font-size:19px;line-height:38px;text-align:center">${meta.emoji}</span></td><td valign="middle"><h2 style="font-size:17px;line-height:1.3;margin:0;color:#111827">${meta.label} <span style="color:#6b7280;font-size:13px">(${tasks.length})</span></h2><p style="font-size:13px;line-height:1.5;color:#62676d;margin:3px 0 0">${meta.description}</p></td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${tasks.map((task) => taskRow(task, recent, timeZone)).join("")}</table></td></tr>`;
}

export function renderTaskDigestEmail(
  digest: TaskDigest,
  recipientName: string,
  sentAt = new Date(),
  instance: InstanceSettings = instanceDefaults,
  timeZone = digestDefaults.timeZone,
) {
  const boardUrl = escapeHtml(tasksAppUrl("/board"));
  const count = taskDigestCount(digest);
  return `<!doctype html><html><body style="margin:0;background:#e7e9e8;color:#111827"><div style="display:none;max-height:0;overflow:hidden">${count} task${count === 1 ? "" : "s"} in your ${escapeHtml(instance.name)} workload rundown.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e7e9e8;font-family:Inter,Arial,sans-serif"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#f1f2ef;border:1px solid #cfd3d1;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(17,24,39,.12)"><tr><td style="background:#ffffff;color:#111827;padding:28px;border-top:6px solid ${instance.accentColor};border-bottom:1px solid #d9dcda"><div style="font-family:Cooper Black,Georgia,serif;font-size:23px;font-weight:900;line-height:1;letter-spacing:.02em;color:#111827;white-space:nowrap">${escapeHtml(instance.name.toUpperCase())}</div><h1 style="margin:24px 0 0;font-family:Cooper Black,Georgia,serif;font-size:30px;line-height:1.15">Your workload rundown</h1><p style="margin:12px 0 0;color:#555b63;font-size:14px;line-height:1.6">Good ${timeOfDay(sentAt, timeZone)}, ${escapeHtml(recipientName)}. Here’s what deserves a look.</p></td></tr>${digest.map((entry) => section(entry, timeZone)).join("")}<tr><td align="center" style="padding:20px 28px 32px"><a href="${boardUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:750;border-radius:12px;padding:14px 24px;box-shadow:0 2px 4px rgba(17,24,39,.18)">Open your task board&nbsp; →</a></td></tr></table></td></tr></table></body></html>`;
}

export function timeOfDay(
  date = new Date(),
  timeZone = digestDefaults.timeZone,
) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(date),
  );
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export async function sendTaskDigestEmail({
  digest,
  digestDate,
  profileId,
  recipientName,
  to,
  idempotencyKey,
  scheduledAt,
  instance = instanceDefaults,
  timeZone = digestDefaults.timeZone,
}: {
  digest: TaskDigest;
  digestDate: string;
  profileId: string;
  recipientName: string;
  to: string;
  idempotencyKey?: string;
  scheduledAt?: string;
  instance?: InstanceSettings;
  timeZone?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.TASK_DIGEST_FROM_EMAIL ??
    process.env.TASK_REMINDER_FROM_EMAIL ??
    process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Task digest email is not configured.");

  const count = taskDigestCount(digest);
  const html = renderTaskDigestEmail(
    digest,
    recipientName,
    scheduledAt ? new Date(scheduledAt) : new Date(),
    instance,
    timeZone,
  );
  const plainTextTasks = digest
    .map(
      ({ key, tasks }) =>
        `${DIGEST_SECTION_META[key as DigestSectionKey].label}\n${tasks
          .map(
            (task) =>
              `- ${taskKey(task)}: ${task.title} — ${tasksAppUrl(taskPath(task))}`,
          )
          .join("\n")}`,
    )
    .join("\n\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key":
        idempotencyKey ?? `task-digest/${profileId}/${digestDate}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${count} task${count === 1 ? "" : "s"} in your ${instance.name} rundown`,
      html,
      text: `Your ${instance.name} rundown\n\n${plainTextTasks}\n\nOpen your board: ${tasksAppUrl("/board")}`,
      ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(
      `Resend rejected the digest (${response.status})${detail ? `: ${detail}` : "."}`,
    );
  }
}
