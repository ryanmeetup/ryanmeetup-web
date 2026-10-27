/**
 * The emails RY-D drafts. Nothing here sends: the page opens each one in the
 * reviewer's own mail app, and they press Send.
 */

import { isRydContactEmail, normalizeEmail } from "./normalize";

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

/**
 * To someone who sent ry-dentification under an email no order uses: usually
 * a gift, a second address, or an order that hasn't come through yet.
 */
export function rydUnmatchedEmail(): RydDraft {
  return {
    subject: "We got your ry-dentification, but can't find your RY-D order",
    body: [
      "Hi there,",
      "Thanks for sending your ry-dentification! We couldn't find a RY-D order under this email address, so we can't match the two up yet.",
      "If you ordered with a different email, or someone ordered your RY-D as a gift, reply with the email or order number it was placed under and we'll connect them.",
      "Haven't ordered yet? Your ry-dentification is saved, and we'll match it once your order comes through.",
      "Thanks, Ryan\nRyan Meetup",
    ].join("\n\n"),
  };
}

/** Tells fulfillment which orders can start, for the file attached beside it. */
export function rydFulfillmentEmail(
  ready: {
    orderId: string;
    firstName: string;
    lastName: string;
    /** Names from explicitly linked form responses, never match suggestions. */
    recipientNames?: string[];
  }[],
  orderCount: number,
): RydDraft {
  const lines = ready.map((order) => {
    const buyer = `${order.firstName} ${order.lastName}`
      .replace(/\s+/g, " ")
      .trim();
    const names = new Map<string, string>();
    for (const value of order.recipientNames ?? []) {
      const answer = value.replace(/\s+/g, " ").trim();
      // An explicit delegation identifies the recipient after the delimiter.
      // Other answers remain verbatim instead of guessing who they describe.
      const name =
        answer.match(/^.+?\s+on\s+behalf\s+of\s+(.+)$/i)?.[1] ?? answer;
      const key = name.normalize("NFC").toLowerCase();
      if (key && !names.has(key)) names.set(key, name);
    }
    if (!names.size)
      return `${order.orderId} · Order placed by ${buyer || "buyer name unavailable"}`;
    const recipient =
      names.size === 1
        ? [...names.values()][0]
        : `Linked form names: ${[...names.values()].join("; ")}`;
    const buyerContext =
      buyer &&
      (names.size !== 1 || !names.has(buyer.normalize("NFC").toLowerCase()))
        ? ` (ordered by ${buyer})`
        : "";
    return `${order.orderId} · ${recipient}${buyerContext}`;
  });
  return {
    subject: `RY-D orders cleared to start: ${ready.length}`,
    body: [
      "Hi,",
      ready.length === orderCount
        ? `${ready.length} verified RY-D order${ready.length === 1 ? " is" : "s are"} ready for production. The attached file contains only these orders, marked ✅ in the Verified? column. Please confirm when production has started.`
        : `${ready.length} of ${orderCount} RY-D order${orderCount === 1 ? "" : "s"} ${ready.length === 1 ? "is" : "are"} verified and ready to start. They're marked ✅ in the Verified? column of the attached file; the rest are still being checked and will come round again.`,
      lines.length ? `Ready to start:\n${lines.join("\n")}` : "",
      "Thanks,\nRyan Meetup",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

/** Asks fulfillment to cancel and refund orders that won't be made. */
export function rydCancellationRequestEmail(
  orders: {
    orderId: string;
    firstName: string;
    lastName: string;
    displayEmail: string;
  }[],
): RydDraft {
  const lines = orders.map((order) => {
    const buyer = `${order.firstName} ${order.lastName}`
      .replace(/\s+/g, " ")
      .trim();
    const contact = order.displayEmail.trim();
    return [
      order.orderId,
      [buyer || "buyer name unavailable", contact && `(${contact})`]
        .filter(Boolean)
        .join(" "),
    ].join(" · ");
  });
  const one = orders.length === 1;
  return {
    subject: `RY-D order${one ? "" : "s"} to cancel and refund: ${orders.length}`,
    body: [
      "Hi,",
      `Please cancel and refund ${one ? "the RY-D order below" : `these ${orders.length} RY-D orders`}. ${one ? "The buyer" : "The buyers"} couldn't be verified as ${one ? "a Ryan" : "Ryans"}, so ${one ? "it won't" : "they won't"} go into production.`,
      `Cancel and refund:\n${lines.join("\n")}`,
      "Please reply once the refunds have gone through so we can let the buyers know.",
      "Thanks,\nRyan Meetup",
    ].join("\n\n"),
  };
}

/** Tells a buyer their order was cancelled and refunded, and why. */
export function rydCancelledBuyerEmail({
  firstName = "",
  hasSubmission,
}: {
  firstName?: string;
  hasSubmission: boolean;
}): RydDraft {
  const why = hasSubmission
    ? "We looked over the ry-dentification you sent, but couldn't confirm from it that you're a Ryan."
    : "We never received ry-dentification for your order, so we couldn't confirm you're a Ryan.";
  return {
    subject: "Your RY-D order has been cancelled and refunded",
    body: [
      `Hi ${firstName.trim() || "there"},`,
      "We've cancelled your RY-D order and refunded it.",
      `RY-Ds are made only for Ryans, so every order needs a quick ry-dentification before we can make it. ${why}`,
      "If you think we got this wrong, just reply to this email.",
      "Thanks, Ryan\nRyan Meetup",
    ].join("\n\n"),
  };
}

/** A link that opens the draft in the reviewer's mail app. */
export function rydMailtoHref({
  to = [],
  bcc = [],
  subject,
  body,
}: RydDraft & { to?: string[]; bcc?: string[] }) {
  const recipients = (addresses: string[]) => [
    ...new Map(
      addresses
        .filter(isRydContactEmail)
        .map((address) => [normalizeEmail(address), address.trim()]),
    ).values(),
  ];
  const copied = recipients(bcc);
  const params = [
    copied.length ? `bcc=${encodeURIComponent(copied.join(","))}` : "",
    `subject=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(body)}`,
  ].filter(Boolean);
  return `mailto:${recipients(to).map(encodeURIComponent).join(",")}?${params.join("&")}`;
}
