import { csvRecordCell } from "./csv";

/**
 * What gets printed on a RY-D: the Ryan's name, where they are, and the year
 * they have been a Ryan. Approved exactly as shown, so a verified card is the
 * card fulfillment prints.
 */
export type RydCard = {
  firstName: string;
  lastName: string;
  location: string;
  ryanSince: string;
};

export const RYD_CARD_FIELDS = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["location", "Location"],
  ["ryanSince", "Ryan since"],
] as const satisfies readonly (readonly [keyof RydCard, string])[];

export const RYD_CARD_LIMITS: Record<keyof RydCard, number> = {
  firstName: 80,
  lastName: 80,
  location: 120,
  ryanSince: 4,
};

/** Where the unsaved card came from, so a reviewer knows what to check. */
export type RydCardHint = {
  /** Chipply's Full Birthday as the buyer typed it, when the export has it. */
  birthday: string;
  /** A year read from a two-digit birthday, offered but never assumed. */
  yearSuggestion: string | null;
  /**
   * `billing` when the export had no card options and the name is the
   * buyer's, which is wrong for a gift.
   */
  nameFrom: "options" | "billing";
};

const OPTIONS_COLUMN = "Options Detail";

/**
 * Chipply's Options Detail: `[First Name : Ryan] [Last Name : Le] …`. Labels
 * are matched ignoring case and spacing; a value keeps everything after the
 * first colon, so a location like `Washington, D.C.` survives.
 */
export function parseOptionsDetail(text: string) {
  const options = new Map<string, string>();
  for (const [, block] of text.matchAll(/\[([^\]]*)\]/g)) {
    const colon = block.indexOf(":");
    if (colon < 0) continue;
    const label = block
      .slice(0, colon)
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const value = block.slice(colon + 1).trim();
    if (label && !options.has(label)) options.set(label, value);
  }
  return options;
}

/**
 * The year in a free-text birthday. Only a four-digit year is taken as the
 * year; `07/14/76` offers 1976 as a suggestion for a person to accept, and
 * `Dec 3` gives nothing.
 */
export function birthYear(birthday: string, today = new Date()) {
  const thisYear = today.getFullYear();
  const full = /(?:^|\D)((?:19|20)\d{2})(?!\d)/.exec(birthday);
  if (full && Number(full[1]) <= thisYear)
    return { year: full[1], suggestion: null };
  const short = /[/.'’-]\s*(\d{2})\s*$/.exec(birthday.trim());
  if (!short) return { year: null, suggestion: null };
  const yy = Number(short[1]);
  const century = yy <= thisYear % 100 ? 2000 : 1900;
  return { year: null, suggestion: String(century + yy) };
}

const REGIONS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  "district of columbia": "DC", "d.c.": "DC", "d.c": "DC", florida: "FL",
  georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN",
  iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME",
  maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE",
  nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "puerto rico": "PR",
  alberta: "AB", "british columbia": "BC", manitoba: "MB",
  "new brunswick": "NB", "newfoundland and labrador": "NL",
  "nova scotia": "NS", ontario: "ON", "prince edward island": "PE",
  quebec: "QC", saskatchewan: "SK",
};
const REGION_CODES = new Set(Object.values(REGIONS));
const COUNTRY_SUFFIX =
  /[,\s]\s*(?:u\.?s\.?a?\.?|united states(?: of america)?|canada)\.?$/i;

function regionCode(text: string) {
  const name = text.trim().replace(/\s+/g, " ").toLowerCase();
  const code = name.replace(/\.$/, "").toUpperCase();
  return REGIONS[name] ?? (REGION_CODES.has(code) ? code : null);
}

/**
 * A card location as `City, ST`. Buyers write `Cleveland Ohio`, `Fresno Ca`,
 * or `Williamsville, Illinois, U.S.A.`; anything without a recognisable city
 * and state or province is left as typed for a person to finish.
 */
export function rydCardLocation(text: string) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  const place = trimmed.replace(COUNTRY_SUFFIX, "").replace(/[.,\s]+$/, "");
  const comma = place.lastIndexOf(",");
  if (comma > 0) {
    const city = place.slice(0, comma).replace(/[,\s]+$/, "").trim();
    const code = regionCode(place.slice(comma + 1));
    return city && code ? `${city}, ${code}` : trimmed;
  }
  // No comma: try the longest trailing run of words that names a region.
  const words = place.split(" ");
  for (let take = Math.min(4, words.length - 1); take >= 1; take -= 1) {
    const code = regionCode(words.slice(-take).join(" "));
    if (code) return `${words.slice(0, -take).join(" ")}, ${code}`;
  }
  return trimmed;
}

/**
 * The card as the export describes it, before anyone has saved one. Without
 * Options Detail the name falls back to billing and the other lines are blank.
 */
export function rydCardDraft(
  raw: Record<string, string>,
  billing: { firstName: string; lastName: string },
  today = new Date(),
): { card: RydCard; hint: RydCardHint } {
  const options = parseOptionsDetail(csvRecordCell(raw, OPTIONS_COLUMN));
  const option = (...labels: string[]) =>
    labels.map((label) => options.get(label)).find(Boolean) ?? "";
  const firstName = option("first name");
  const lastName = option("last name");
  const fromOptions = Boolean(firstName || lastName);
  const birthday = option("full birthday", "birthday");
  const { year, suggestion } = birthYear(birthday, today);
  return {
    card: {
      firstName: fromOptions ? firstName : billing.firstName.trim(),
      lastName: fromOptions ? lastName : billing.lastName.trim(),
      location: rydCardLocation(option("location")),
      ryanSince: year ?? "",
    },
    hint: {
      birthday,
      yearSuggestion: suggestion,
      nameFrom: fromOptions ? "options" : "billing",
    },
  };
}

/** The labels of every line that would stop this card being verified. */
export function rydCardProblems(card: RydCard, today = new Date()) {
  const problems: string[] = [];
  for (const [field, label] of RYD_CARD_FIELDS) {
    const value = card[field].trim();
    if (!value || value.length > RYD_CARD_LIMITS[field]) problems.push(label);
  }
  const year = card.ryanSince.trim();
  if (
    year &&
    (!/^\d{4}$/.test(year) ||
      Number(year) < 1900 ||
      Number(year) > today.getFullYear()) &&
    !problems.includes("Ryan since")
  )
    problems.push("Ryan since");
  return problems;
}

export function rydCardComplete(card: RydCard, today = new Date()) {
  return rydCardProblems(card, today).length === 0;
}

/** Trim every line, the form the database stores and prints. */
export function normalizeRydCard(card: RydCard): RydCard {
  return {
    firstName: card.firstName.trim(),
    lastName: card.lastName.trim(),
    location: card.location.trim(),
    ryanSince: card.ryanSince.trim(),
  };
}

/** The saved card on an order row, or null when nobody has saved one yet. */
export function savedRydCard(row: {
  card_first_name?: string | null;
  card_last_name?: string | null;
  card_location?: string | null;
  card_ryan_since?: string | null;
}): RydCard | null {
  if (
    row.card_first_name == null &&
    row.card_last_name == null &&
    row.card_location == null &&
    row.card_ryan_since == null
  )
    return null;
  return {
    firstName: row.card_first_name ?? "",
    lastName: row.card_last_name ?? "",
    location: row.card_location ?? "",
    ryanSince: row.card_ryan_since ?? "",
  };
}
