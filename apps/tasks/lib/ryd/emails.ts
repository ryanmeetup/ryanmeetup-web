/**
 * The emails RY-D drafts. Nothing here sends: the page opens each one in the
 * reviewer's own mail app, and they press Send.
 */

import type { RydQueueOrder } from "./queue-types";

/** Where buyers send their evidence. The page on ryanmeetup.com redirects to the form. */
export const RYD_FORM_URL = "https://ryanmeetup.com/cards/verify";

export type RydDraft = { subject: string; body: string };

/** Asks a buyer to verify, or to add a little more if they already tried. */
export function rydBuyerEmail({
  firstName = "",
  hasSubmission,
}: {
  firstName?: string;
  hasSubmission: boolean;
}): RydDraft {
  const ask = hasSubmission
    ? "Thanks for sending your ry-dentification. We couldn't quite confirm it from what came through, so could you add a little more? A social profile with your name and photo, a work or school page, or anything else that shows you're a Ryan works. No government ID needed, ever."
    : "Thanks for ordering a RY-D! Before we can start making it, we need to confirm you're a Ryan. It takes a minute: share a social profile, a work or school page, or anything else that shows your name. No government ID needed, ever.";
  return {
    subject: hasSubmission
      ? "Your RY-D needs a little more ry-dentification"
      : "One quick step before we make your RY-D",
    body: [
      `Hi ${firstName.trim() || "there"},`,
      ask,
      `Send it here: ${RYD_FORM_URL}`,
      "Use the same email you ordered with so we can match it to your order.",
      "Thanks, Ryan\nRyan Meetup",
    ].join("\n\n"),
  };
}

/** Tells fulfillment which orders can start, for the file attached beside it. */
export function rydFulfillmentEmail(
  ready: { orderId: string; firstName: string; lastName: string }[],
  orderCount: number,
): RydDraft {
  const lines = ready.map((order) =>
    [order.orderId, `${order.firstName} ${order.lastName}`.trim()]
      .filter(Boolean)
      .join(" · "),
  );
  return {
    subject: `RY-D orders cleared to start: ${ready.length}`,
    body: [
      "Hi,",
      `${ready.length} of ${orderCount} RY-D order${orderCount === 1 ? "" : "s"} ${ready.length === 1 ? "is" : "are"} verified and ready to start. They're marked ✅ in the Verified? column of the attached file; the rest are still being checked and will come round again.`,
      lines.length ? `Ready to start:\n${lines.join("\n")}` : "",
      "Thanks,\nRyan Meetup",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

/** A link that opens the draft in the reviewer's mail app. */
export function rydMailtoHref({
  to = [],
  bcc = [],
  subject,
  body,
}: RydDraft & { to?: string[]; bcc?: string[] }) {
  const params = [
    bcc.length ? `bcc=${encodeURIComponent(bcc.join(","))}` : "",
    `subject=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(body)}`,
  ].filter(Boolean);
  return `mailto:${to.join(",")}?${params.join("&")}`;
}

/** A draft to one buyer, greeting them by name. */
export function rydBuyerMailtoHref(
  order: Pick<RydQueueOrder, "firstName" | "displayEmail">,
  hasSubmission: boolean,
) {
  return rydMailtoHref({
    to: [order.displayEmail],
    ...rydBuyerEmail({ firstName: order.firstName, hasSubmission }),
  });
}
