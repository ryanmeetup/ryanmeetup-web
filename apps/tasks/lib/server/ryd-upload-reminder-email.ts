import { tasksAppUrl } from "@/lib/app-url";
import type { InstanceSettings } from "@/lib/instance";
import { escapeHtml } from "./task-digest-email";

export type RydUploadReminderCounts = { pending: number; needsInfo: number };

/** What's still waiting, as a sentence, or null when the queue is clear. */
export function rydQueueSummary({
  pending,
  needsInfo,
}: RydUploadReminderCounts) {
  const parts = [
    pending ? `${pending} pending` : "",
    needsInfo ? `${needsInfo} waiting on more info` : "",
  ].filter(Boolean);
  return parts.length
    ? `The queue still has ${parts.join(" and ")} from earlier weeks.`
    : null;
}

/** The weekly nudge, in the digest's frame so the two read as one family. */
export function renderRydUploadReminderEmail({
  recipientName,
  counts,
  instance,
}: {
  recipientName: string;
  counts: RydUploadReminderCounts;
  instance: InstanceSettings;
}) {
  const url = escapeHtml(tasksAppUrl("/ryd"));
  const summary = rydQueueSummary(counts);
  return `<!doctype html><html><body style="margin:0;background:#e7e9e8;color:#111827"><div style="display:none;max-height:0;overflow:hidden">Upload this week's RY-D orders from fulfillment.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e7e9e8;font-family:Inter,Arial,sans-serif"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#f1f2ef;border:1px solid #cfd3d1;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(17,24,39,.12)"><tr><td style="background:#ffffff;color:#111827;padding:28px;border-top:6px solid ${instance.accentColor};border-bottom:1px solid #d9dcda"><div style="font-family:Cooper Black,Georgia,serif;font-size:23px;font-weight:900;line-height:1;letter-spacing:.02em;color:#111827;white-space:nowrap">${escapeHtml(instance.name.toUpperCase())}</div><h1 style="margin:24px 0 0;font-family:Cooper Black,Georgia,serif;font-size:30px;line-height:1.15">New RY-D orders?</h1><p style="margin:12px 0 0;color:#555b63;font-size:14px;line-height:1.6">Hi ${escapeHtml(recipientName)}. It's upload day: check for this week's order file from fulfillment and add it to RY-D Verification, so every new Ryan gets matched and verified.</p>${summary ? `<p style="margin:12px 0 0;color:#555b63;font-size:14px;line-height:1.6">${escapeHtml(summary)}</p>` : ""}</td></tr><tr><td align="center" style="padding:24px 28px 32px"><a href="${url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:750;border-radius:12px;padding:14px 24px;box-shadow:0 2px 4px rgba(17,24,39,.18)">Open RY-D Verification&nbsp; →</a></td></tr></table></td></tr></table></body></html>`;
}

export async function sendRydUploadReminderEmail({
  to,
  recipientName,
  counts,
  instance,
  idempotencyKey,
  from,
  apiKey,
}: {
  to: string;
  recipientName: string;
  counts: RydUploadReminderCounts;
  instance: InstanceSettings;
  idempotencyKey: string;
  from: string;
  apiKey: string;
}) {
  const summary = rydQueueSummary(counts);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Upload this week's RY-D orders",
      html: renderRydUploadReminderEmail({ recipientName, counts, instance }),
      text: `It's upload day: check for this week's order file from fulfillment and add it to RY-D Verification.${summary ? `\n\n${summary}` : ""}\n\nOpen RY-D Verification: ${tasksAppUrl("/ryd")}`,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(
      `Resend rejected the RY-D reminder (${response.status})${detail ? `: ${detail}` : "."}`,
    );
  }
}
