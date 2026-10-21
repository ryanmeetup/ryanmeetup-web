import type { RydSubmission } from "./matching";
import {
  nameTokens,
  ryanPosition,
  type RyanPosition,
  type SocialLink,
} from "./normalize";
import type { RydOrderStatus } from "./orders";

/**
 * Who is buying RY-Ds, for reading back in Claude through the MCP connector.
 *
 * An order is fulfillment's row plus whatever the buyer sent through the
 * RY-dentification form, once someone has linked the two. Everything here
 * includes private identifying data. Only the structured buyer email is
 * reduced to its domain; names, notes, answer text, social URLs, and order
 * text remain and can contain addresses. Upload IDs and contents are omitted.
 */

export type RydInsightOrder = {
  order_id: string;
  ordered_at: string;
  first_name: string;
  last_name: string;
  email: string;
  raw: Record<string, string>;
  status: RydOrderStatus;
  note: string | null;
  decided_at: string | null;
  cleared_batch_id: string | null;
  created_at: string;
};

export type EmailKind = "personal" | "school" | "work_or_other" | "none";

export type RydOrderProfile = {
  orderId: string;
  orderedAt: string;
  /** YYYY-MM-DD, parsed from fulfillment's `OrderDate`. */
  orderDate: string | null;
  status: RydOrderStatus;
  sentToFulfillment: boolean;
  buyerFirstName: string;
  buyerLastName: string;
  emailDomain: string | null;
  emailKind: EmailKind;
  total: number | null;
  items: string;
  delivery: string;
  storeName: string;
  organization: string;
  note: string | null;
  /** The first name on the form, which is not the buyer's on a gift order. */
  formFirstName: string | null;
  /** Where Ryan falls in the form's name: "Steven Ryan Fox" is "middle". */
  ryanPosition: RyanPosition | null;
  /** True when the form names someone the buyer's first name isn't. */
  likelyGift: boolean | null;
  submissions: {
    legalName: string;
    submittedAt: string;
    socialLinks: Pick<SocialLink, "platform" | "label" | "url">[];
    otherAnswers: { question: string; answer: string }[];
  }[];
};

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "comcast.net",
  "att.net",
  "verizon.net",
]);

export function emailKind(domain: string | null): EmailKind {
  if (!domain) return "none";
  if (PERSONAL_DOMAINS.has(domain)) return "personal";
  if (/\.edu$|\.edu\.|\.ac\.[a-z]{2}$|\.k12\./.test(domain)) return "school";
  return "work_or_other";
}

/** "1,036.75" or "$36.75" as a number; blank and junk as null. */
export function orderTotal(value: string | undefined) {
  const cleaned = (value ?? "").replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const total = Number(cleaned);
  return Number.isFinite(total) ? total : null;
}

/** "10/14/2026 3:34 PM", fulfillment's format, as "2026-10-14". */
export function orderDate(orderedAt: string) {
  const match = orderedAt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match)
    return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return orderedAt.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

/** One spelling per name however it was typed: "RYAN ", "ryan" → "Ryan". */
function displayName(value: string) {
  const [first] = nameTokens(value);
  return first ? first[0].toUpperCase() + first.slice(1) : "";
}

export function profileRydOrder(
  order: RydInsightOrder,
  submissions: RydSubmission[],
): RydOrderProfile {
  const at = order.email.lastIndexOf("@");
  const domain = at < 0 ? null : order.email.slice(at + 1) || null;
  const legalName = submissions.find((s) => s.legalName)?.legalName ?? "";
  const formFirstName = legalName ? displayName(legalName) : null;
  const buyerFirstName = displayName(order.first_name);
  return {
    orderId: order.order_id,
    orderedAt: order.ordered_at,
    orderDate: orderDate(order.ordered_at),
    status: order.status,
    sentToFulfillment: Boolean(order.cleared_batch_id),
    buyerFirstName,
    buyerLastName: order.last_name.trim(),
    emailDomain: domain,
    emailKind: emailKind(domain),
    total: orderTotal(order.raw.OrderTotal),
    items: (order.raw.OrderItems ?? "").trim(),
    delivery: (order.raw.Delivery ?? "").trim(),
    storeName: (order.raw["Store Name"] ?? "").trim(),
    organization: (order.raw.Organization ?? "").trim(),
    note: order.note,
    formFirstName,
    ryanPosition: ryanPosition(legalName),
    likelyGift:
      legalName && buyerFirstName
        ? !nameTokens(legalName).includes(buyerFirstName.toLowerCase())
        : null,
    submissions: submissions.map((s) => ({
      legalName: s.legalName,
      submittedAt: s.submittedAt,
      socialLinks: s.socialLinks.map(({ platform, label, url }) => ({
        platform,
        label,
        url,
      })),
      otherAnswers: s.otherAnswers,
    })),
  };
}

type Bucket = { orders: number; revenue: number };

function add(
  group: Record<string, Bucket>,
  key: string | null | undefined,
  total: number | null,
) {
  const name = key?.trim() || "none";
  const bucket = (group[name] ??= { orders: 0, revenue: 0 });
  bucket.orders += 1;
  bucket.revenue += total ?? 0;
}

/** Largest first, with revenue rounded to cents, so it reads as a table. */
function ranked(group: Record<string, Bucket>, limit = 50) {
  return Object.entries(group)
    .sort(([, a], [, b]) => b.orders - a.orders || b.revenue - a.revenue)
    .slice(0, limit)
    .map(([value, bucket]) => ({
      value,
      orders: bucket.orders,
      revenue: Math.round(bucket.revenue * 100) / 100,
    }));
}

const MAX_ANSWERS_PER_QUESTION = 25;

export function summarizeRydSales(profiles: RydOrderProfile[]) {
  const groups = {
    byStatus: {} as Record<string, Bucket>,
    byMonth: {} as Record<string, Bucket>,
    byBuyerFirstName: {} as Record<string, Bucket>,
    byFormFirstName: {} as Record<string, Bucket>,
    byRyanPosition: {} as Record<string, Bucket>,
    byLastName: {} as Record<string, Bucket>,
    byEmailKind: {} as Record<string, Bucket>,
    byEmailDomain: {} as Record<string, Bucket>,
    byDelivery: {} as Record<string, Bucket>,
    byItems: {} as Record<string, Bucket>,
    byStore: {} as Record<string, Bucket>,
    byOrganization: {} as Record<string, Bucket>,
    bySocialPlatform: {} as Record<string, Bucket>,
  };
  const answers = new Map<string, Map<string, number>>();
  let revenue = 0;
  let linked = 0;
  let gifts = 0;
  let selfPurchases = 0;

  for (const profile of profiles) {
    const total = profile.total;
    revenue += total ?? 0;
    add(groups.byStatus, profile.status, total);
    add(groups.byMonth, profile.orderDate?.slice(0, 7), total);
    add(groups.byBuyerFirstName, profile.buyerFirstName, total);
    add(groups.byLastName, profile.buyerLastName, total);
    add(groups.byEmailKind, profile.emailKind, total);
    add(groups.byEmailDomain, profile.emailDomain, total);
    add(groups.byDelivery, profile.delivery, total);
    add(groups.byItems, profile.items, total);
    add(groups.byStore, profile.storeName, total);
    add(groups.byOrganization, profile.organization, total);
    if (profile.submissions.length) {
      linked += 1;
      add(groups.byFormFirstName, profile.formFirstName, total);
      add(groups.byRyanPosition, profile.ryanPosition, total);
    }
    if (profile.likelyGift === true) gifts += 1;
    if (profile.likelyGift === false) selfPurchases += 1;

    const platforms = new Set(
      profile.submissions.flatMap((s) => s.socialLinks.map((l) => l.platform)),
    );
    for (const platform of platforms)
      add(groups.bySocialPlatform, platform, total);

    for (const submission of profile.submissions)
      for (const { question, answer } of submission.otherAnswers) {
        const counts = answers.get(question) ?? new Map<string, number>();
        const key = answer.trim().toLowerCase().slice(0, 200);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        answers.set(question, counts);
      }
  }

  return {
    totals: {
      orders: profiles.length,
      revenue: Math.round(revenue * 100) / 100,
      sentToFulfillment: profiles.filter((p) => p.sentToFulfillment).length,
      linkedToForm: linked,
      likelyGifts: gifts,
      selfPurchases,
    },
    distributions: Object.fromEntries(
      Object.entries(groups).map(([name, group]) => [name, ranked(group)]),
    ),
    formAnswers: [...answers].map(([question, counts]) => ({
      question,
      responses: [...counts.values()].reduce((sum, n) => sum + n, 0),
      topAnswers: [...counts]
        .sort(([, a], [, b]) => b - a)
        .slice(0, MAX_ANSWERS_PER_QUESTION)
        .map(([answer, count]) => ({ answer, count })),
    })),
  };
}
