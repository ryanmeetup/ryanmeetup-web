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

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * The inbox an address delivers to: a `+tag` never changes it, and Gmail also
 * ignores dots. `ryan.fox+ryd@gmail.com` and `ryanfox@gmail.com` are one person.
 */
function mailbox(email: string) {
  const { local, domain } = emailParts(email);
  const bare = local.split("+")[0];
  return GMAIL_DOMAINS.has(domain)
    ? `${bare.replaceAll(".", "")}@gmail.com`
    : `${bare}@${domain}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Where the buyer pointed at the order themselves: its number or the email it
 * was placed under, typed into any answer. Deliberate evidence, unlike a name
 * that happens to agree.
 */
function orderReference(order: OrderIdentity, submitter: RydSubmitter) {
  const text = submitter.submissions
    .flatMap((s) => [s.socialText, ...s.otherAnswers.map((a) => a.answer)])
    .join("\n")
    .toLowerCase();
  if (!text) return null;
  const orderId = order.orderId.trim().toLowerCase();
  if (
    orderId.length >= 5 &&
    new RegExp(`(?<![a-z0-9])${escapeRegExp(orderId)}(?![a-z0-9])`).test(text)
  )
    return `Form mentions order ${order.orderId.trim()}`;
  const orderEmail = normalizeEmail(order.email);
  if (
    isRydContactEmail(orderEmail) &&
    orderEmail !== submitter.email &&
    new RegExp(
      `(?<![a-z0-9._%+-])${escapeRegExp(orderEmail)}(?![a-z0-9-])`,
    ).test(text)
  )
    return "Form gives the order email";
  return null;
}

/** A different address that still points at the buyer, or null. */
function nearContact(orderEmail: string, submitter: RydSubmitter) {
  const theirs = submitter.email;
  const ordered = emailParts(orderEmail);
  const submitted = emailParts(theirs);
  if (orderEmail && theirs) {
    const distance = editDistance(orderEmail, theirs);
    if (distance <= 2)
      return `Email differs by ${distance === 1 ? "one character" : "two characters"}`;
    if (ordered.local === submitted.local) {
      if (editDistance(ordered.domain, submitted.domain) <= 2)
        return "Same email name, domain looks mistyped";
      // `ry` at two providers says little; `rguardy2012` says a lot.
      if (ordered.local.length >= 5)
        return "Same email name at another provider";
    }
  }
  const handles = submitter.submissions.flatMap((s) =>
    s.socialLinks.map((link) => link.handle).filter(Boolean),
  );
  if (ordered.local && handles.includes(ordered.local))
    return `Social handle @${ordered.local} matches the order email`;
  return null;
}

/** The form's surname for the name that carries the order's first name. */
function formSurname(names: string[], firstName: string) {
  const name = names.find((n) => nameIncludes(n, firstName));
  return name?.trim().split(/\s+/).at(-1) ?? "";
}

/** One slip in a surname of four letters or more: Smyth for Smith. */
function surnameNearlyMatches(formLast: string, orderLast: string) {
  const a = nameTokens(formLast).join("");
  const b = nameTokens(orderLast).join("");
  return a.length >= 4 && b.length >= 4 && editDistance(a, b) <= 1;
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
  // The same inbox, however it was written, is the buyer filling in the form.
  const sameEmail = Boolean(orderEmail) && orderEmail === theirs;
  const sameMailbox =
    sameEmail ||
    (isRydContactEmail(orderEmail) && mailbox(orderEmail) === mailbox(theirs));
  const emailReason = sameEmail
    ? "Email matches"
    : "Same mailbox, written differently";
  const reference = orderReference(order, submitter);
  const firstMatches = names.some((name) =>
    nameIncludes(name, order.firstName),
  );
  // The rule for gifts: when the buyer isn't the Ryan on the form, a shared
  // surname suggests nothing, since Jamie Perez may be any Ryan Pêrez's
  // parent. The buyer's own inbox, or the order quoted on the form, is
  // different: the buyer filled in the form themselves, for the Ryan they
  // bought it for. It's still only possible, so a reviewer reads the evidence
  // before verifying.
  if (!firstMatches) {
    const ryan = names.find((name) => nameTokens(name).length > 0);
    const proof = sameMailbox ? emailReason : reference;
    return proof && ryan
      ? {
          email: theirs,
          confidence: "possible",
          reasons: [proof, `A gift: the form names ${ryan.trim()}`],
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
    // "Ryan" alone on the form, or a surname that differs: a typo, a married
    // name, or another Ryan in the household. Only the buyer's own inbox or
    // the order quoted on the form makes that worth a reviewer's look; a near
    // surname also accepts a near email, never a name alone.
    const firstNameOnly = names.every((name) => nameTokens(name).length <= 1);
    const formLast = formSurname(names, order.firstName);
    const near = surnameNearlyMatches(formLast, order.lastName);
    const nameReason = firstNameOnly
      ? "Form gives only a first name"
      : near
        ? `Surname spelled ${formLast} on the form`
        : `Form gives the surname ${formLast}`;
    const proof = sameMailbox
      ? emailReason
      : (reference ??
        (near && !firstNameOnly ? nearContact(orderEmail, submitter) : null));
    return proof
      ? { email: theirs, confidence: "possible", reasons: [proof, nameReason] }
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

  // Full name plus the buyer's inbox, or plus the order quoted on the form.
  const proof = sameMailbox ? emailReason : reference;
  if (proof)
    return {
      email: theirs,
      confidence: "strong",
      reasons: [proof, nameReason],
    };

  const contact = nearContact(orderEmail, submitter);
  if (contact)
    return {
      email: theirs,
      confidence: "possible",
      reasons: [contact, nameReason],
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
    direct: boolean;
  })[] = [];
  for (const order of orders)
    for (const submitter of submitters) {
      if (claimedEmails.has(submitter.email)) continue;
      const suggestion = scoreSubmitter(order, submitter);
      if (!suggestion) continue;
      const orderEmail = normalizeEmail(order.email);
      candidates.push({
        ...suggestion,
        orderId: order.orderId,
        // The buyer's own inbox, or the order quoted on the form, outranks
        // an equally confident pairing that rests on names.
        direct:
          (isRydContactEmail(orderEmail) &&
            mailbox(orderEmail) === mailbox(submitter.email)) ||
          orderReference(order, submitter) !== null,
      });
    }

  candidates.sort(
    (a, b) =>
      CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence] ||
      Number(b.direct) - Number(a.direct),
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
