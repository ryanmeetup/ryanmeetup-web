import {
  editDistance,
  nameIncludes,
  nameTokens,
  normalizeEmail,
  type SocialLink,
} from "./normalize";

/** One row of the RY-dentification form, as read from the sheet. */
export type RydSubmission = {
  /**
   * Stable identity: normalized email plus the form timestamp. Sheet row
   * numbers move when someone sorts the sheet; these two never do.
   */
  key: string;
  /** 1-based sheet row, for writing `Verified?` back. Not an identity. */
  row: number;
  submittedAt: string;
  legalName: string;
  email: string;
  fileIds: string[];
  socialText: string;
  socialLinks: SocialLink[];
  /** Already ticked in the sheet. */
  verified: boolean;
};

export function rydSubmissionKey(email: string, timestamp: string) {
  return `${normalizeEmail(email)}|${timestamp.trim()}`;
}

/**
 * Duplicate submissions from one address are one person answering twice, not
 * two people. Grouping by email is what keeps Basabe's two uploads together.
 */
export type RydSubmitter = {
  email: string;
  submissions: RydSubmission[];
};

export function groupSubmissions(submissions: RydSubmission[]) {
  const groups = new Map<string, RydSubmitter>();
  for (const submission of submissions) {
    const group = groups.get(submission.email) ?? {
      email: submission.email,
      submissions: [],
    };
    group.submissions.push(submission);
    groups.set(submission.email, group);
  }
  return [...groups.values()];
}

export type MatchConfidence = "strong" | "possible" | "weak";

export type RydMatchSuggestion = {
  email: string;
  confidence: MatchConfidence;
  reasons: string[];
};

type OrderIdentity = {
  orderId: string;
  firstName: string;
  lastName: string;
  email: string;
};

const CONFIDENCE_RANK: Record<MatchConfidence, number> = {
  strong: 0,
  possible: 1,
  weak: 2,
};

function emailParts(email: string) {
  const at = email.lastIndexOf("@");
  return at < 0
    ? { local: email, domain: "" }
    : { local: email.slice(0, at), domain: email.slice(at + 1) };
}

/** How one submitter relates to one order, or null when they don't. */
export function scoreSubmitter(
  order: OrderIdentity,
  submitter: RydSubmitter,
): RydMatchSuggestion | null {
  const names = submitter.submissions.map((s) => s.legalName);
  const orderEmail = normalizeEmail(order.email);
  const theirs = submitter.email;
  const firstMatches = names.some((name) =>
    nameIncludes(name, order.firstName),
  );
  // The rule for gifts: when the buyer isn't the Ryan on the form, nothing
  // here suggests the pair, even when a parent shares the Ryan's surname. A
  // reviewer links Jamie Perez to Ryan Pêrez by hand.
  if (!firstMatches) return null;

  const surnameMatches =
    nameTokens(order.lastName).length > 0 &&
    names.some((name) => nameIncludes(name, order.lastName));
  if (!surnameMatches) {
    // "Ryan" alone on the form, from the address on the order.
    const firstNameOnly = names.every((name) => nameTokens(name).length <= 1);
    return firstNameOnly && orderEmail === theirs
      ? {
          email: theirs,
          confidence: "possible",
          reasons: ["Email matches", "Form gives only a first name"],
        }
      : null;
  }
  const nameReason = "Full name matches";

  if (orderEmail && orderEmail === theirs)
    return {
      email: theirs,
      confidence: "strong",
      reasons: ["Email matches", nameReason],
    };

  const ordered = emailParts(orderEmail);
  const submitted = emailParts(theirs);
  if (orderEmail && theirs) {
    const distance = editDistance(orderEmail, theirs);
    if (distance <= 2)
      return {
        email: theirs,
        confidence: "possible",
        reasons: [
          `Email differs by ${distance === 1 ? "one character" : "two characters"}`,
          nameReason,
        ],
      };
    if (
      ordered.local === submitted.local &&
      editDistance(ordered.domain, submitted.domain) <= 2
    )
      return {
        email: theirs,
        confidence: "possible",
        reasons: ["Same email name, domain looks mistyped", nameReason],
      };
  }

  const handles = submitter.submissions.flatMap((s) =>
    s.socialLinks.map((link) => link.handle).filter(Boolean),
  );
  if (ordered.local && handles.includes(ordered.local))
    return {
      email: theirs,
      confidence: "possible",
      reasons: [
        `Social handle @${ordered.local} matches the order email`,
        nameReason,
      ],
    };

  return {
    email: theirs,
    confidence: "weak",
    reasons: ["Full name matches, email differs"],
  };
}

/**
 * Best suggestion per order. A submitter is suggested for at most one order —
 * the one it fits best, ties broken by email — so two Ryan Johnsons are never
 * both offered the same person. Orders already linked are left alone, and so
 * are the submitters they claimed.
 */
export function suggestMatches(
  orders: OrderIdentity[],
  submitters: RydSubmitter[],
  claimedEmails: ReadonlySet<string> = new Set(),
) {
  const candidates: (RydMatchSuggestion & {
    orderId: string;
    exact: boolean;
  })[] = [];
  for (const order of orders)
    for (const submitter of submitters) {
      if (claimedEmails.has(submitter.email)) continue;
      const suggestion = scoreSubmitter(order, submitter);
      if (suggestion)
        candidates.push({
          ...suggestion,
          orderId: order.orderId,
          exact: normalizeEmail(order.email) === submitter.email,
        });
    }

  candidates.sort(
    (a, b) =>
      CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence] ||
      Number(b.exact) - Number(a.exact),
  );
  const byOrder = new Map<string, RydMatchSuggestion>();
  const usedEmails = new Set<string>();
  for (const { orderId, email, confidence, reasons } of candidates) {
    if (byOrder.has(orderId) || usedEmails.has(email)) continue;
    byOrder.set(orderId, { email, confidence, reasons });
    usedEmails.add(email);
  }
  return byOrder;
}
