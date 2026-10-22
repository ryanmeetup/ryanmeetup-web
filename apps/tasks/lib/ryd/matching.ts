import {
  editDistance,
  nameIncludes,
  nameTokens,
  normalizeEmail,
  isRydContactEmail,
  type SocialLink,
} from "./normalize";

/** One response to the RY-dentification form, as read from Google Forms. */
export type RydSubmission = {
  /** The form's response ID: stable across edits to the response. */
  key: string;
  /** For display, in the workspace's zone. */
  submittedAt: string;
  submittedAtIso: string;
  legalName: string;
  email: string;
  fileIds: string[];
  socialText: string;
  socialLinks: SocialLink[];
  /** Answers to questions matching doesn't use, so none of them are hidden. */
  otherAnswers: { question: string; answer: string }[];
};

/**
 * Duplicate submissions from one address are one person answering twice, not
 * two people. Grouping by email is what keeps Basabe's two uploads together.
 */
export type RydSubmitter = {
  /** Identity for grouping and selection, separate from a contact address. */
  key: string;
  email: string;
  submissions: RydSubmission[];
};

export function groupSubmissions(submissions: RydSubmission[]) {
  const groups = new Map<string, RydSubmitter>();
  for (const submission of submissions) {
    const email = normalizeEmail(submission.email);
    const key = isRydContactEmail(email)
      ? `email:${email}`
      : `response:${submission.key}`;
    const group = groups.get(key) ?? {
      key,
      email,
      submissions: [],
    };
    group.submissions.push(submission);
    groups.set(key, group);
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
  if (!isRydContactEmail(submitter.email)) return null;
  const names = submitter.submissions.map((s) => s.legalName);
  const orderEmail = normalizeEmail(order.email);
  const theirs = submitter.email;
  const firstMatches = names.some((name) =>
    nameIncludes(name, order.firstName),
  );
  // The rule for gifts: when the buyer isn't the Ryan on the form, a shared
  // surname suggests nothing, since Jamie Perez may be any Ryan Pêrez's
  // parent. The same email is different: the buyer filled in the form
  // themselves, for the Ryan they bought it for. It's still only possible,
  // so a reviewer reads the evidence before verifying.
  if (!firstMatches) {
    const ryan = names.find((name) => nameTokens(name).length > 0);
    return orderEmail && orderEmail === theirs && ryan
      ? {
          email: theirs,
          confidence: "possible",
          reasons: ["Email matches", `A gift: the form names ${ryan.trim()}`],
        }
      : null;
  }

  const surnameMatches =
    nameTokens(order.lastName).length > 0 &&
    names.some(
      (name) =>
        nameIncludes(name, order.firstName) &&
        nameIncludes(name, order.lastName),
    );
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
  // "Ryan Fox" on the order and "Steven Ryan Fox" on the form is the same
  // person, but Ryan is their middle name. The pairing is still right; the
  // reviewer just needs to see it before verifying.
  const orderFirst = nameTokens(order.firstName);
  const leadsWithFirstName = names.some((name) => {
    const tokens = nameTokens(name);
    return orderFirst.every((token, index) => tokens[index] === token);
  });
  const nameReason = leadsWithFirstName
    ? "Full name matches"
    : `Full name matches, with ${order.firstName.trim()} as a middle name`;

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
    reasons: [`${nameReason}, email differs`],
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
