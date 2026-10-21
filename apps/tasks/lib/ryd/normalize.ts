import { ensureHttpUrlScheme } from "@ryanmeetup/utils";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/** A single address usable in a draft, without recipient or query delimiters. */
export function isRydContactEmail(value: string) {
  return (
    value.length <= 320 &&
    /^[^\s@,;<>?&#="\r\n]+@[^\s@,;<>?&#="\r\n]+\.[^\s@,;<>?&#="\r\n]+$/.test(
      value.trim(),
    )
  );
}

/**
 * Lowercase, accent-free words. Buyers type "Pêrez", "O’Shea", and
 * "SHUSTER-CONLEY"; the order sheet has "Perez", "O'Shea", and
 * "Shuster-Conley".
 */
export function nameTokens(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export type RyanPosition = "first" | "middle" | "last" | "absent";

const RYAN_SPELLINGS = new Set(["ryan", "ryann", "ryanne", "rian", "ryen", "ryne"]);

/**
 * Where Ryan falls in a name: "Steven Ryan Fox" is a middle-name Ryan, "Paul
 * Ryan" a surname one. Null when there is no name to read.
 */
export function ryanPosition(name: string): RyanPosition | null {
  const tokens = nameTokens(name);
  if (!tokens.length) return null;
  const index = tokens.findIndex((token) => RYAN_SPELLINGS.has(token));
  if (index < 0) return "absent";
  if (index === 0) return "first";
  return index === tokens.length - 1 ? "last" : "middle";
}

/** True when every word of `part` appears among the words of `name`. */
export function nameIncludes(name: string, part: string) {
  const haystack = new Set(nameTokens(name));
  const needle = nameTokens(part);
  return needle.length > 0 && needle.every((token) => haystack.has(token));
}

export function editDistance(a: string, b: string) {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

export type SocialLink = {
  /** Where the chip goes. */
  url: string;
  /** What the chip reads as: a handle where one is known, else the host. */
  label: string;
  platform: "instagram" | "facebook" | "linkedin" | "x" | "tiktok" | "web";
  /** Lowercase account name when the link names one, for matching. */
  handle: string | null;
};

const PLATFORM_HOSTS: Record<string, SocialLink["platform"]> = {
  "instagram.com": "instagram",
  "facebook.com": "facebook",
  "linkedin.com": "linkedin",
  "x.com": "x",
  "twitter.com": "x",
  "tiktok.com": "tiktok",
};

const HANDLE_PROFILES: Partial<Record<SocialLink["platform"], string>> = {
  instagram: "https://www.instagram.com/",
  x: "https://x.com/",
  tiktok: "https://www.tiktok.com/@",
};

function platformOf(host: string): SocialLink["platform"] {
  const bare = host.replace(/^(www|m)\./, "");
  return PLATFORM_HOSTS[bare] ?? "web";
}

function handleFromUrl(url: URL, platform: SocialLink["platform"]) {
  // Instagram's login wall wraps the profile in `?next=/handle`.
  const next = url.searchParams.get("next");
  const path =
    next && platform === "instagram"
      ? new URL(next, url).pathname
      : url.pathname;
  const segments = path.split("/").filter(Boolean);
  if (platform === "linkedin")
    return segments[0] === "in" ? (segments[1] ?? null) : null;
  if (platform === "facebook")
    return segments[0] && segments[0] !== "share" ? segments[0] : null;
  if (platform === "web") return null;
  return segments[0]?.replace(/^@/, "") ?? null;
}

const PLATFORM_NAMES: Record<SocialLink["platform"], string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  web: "Website",
};

function linkLabel(
  platform: SocialLink["platform"],
  handle: string | null,
  host: string,
) {
  if (platform === "web") return host.replace(/^www\./, "");
  // LinkedIn and Facebook names are profile slugs, not @-handles.
  if (!handle || platform === "linkedin" || platform === "facebook")
    return PLATFORM_NAMES[platform];
  return `@${handle}`;
}

function linkFromUrl(raw: string): SocialLink | null {
  let url: URL;
  try {
    url = new URL(ensureHttpUrlScheme(raw.replace(/[;,.]+$/, "")));
  } catch {
    return null;
  }
  if (!url.hostname.includes(".")) return null;
  const platform = platformOf(url.hostname);
  const handle = handleFromUrl(url, platform)?.toLowerCase() ?? null;
  // Share links carry tracking parameters that identify the sharer, not the
  // profile. Facebook share links need their path; nothing needs the query.
  const clean = new URL(url.origin + url.pathname);
  if (platform === "instagram" && handle)
    clean.href = `${HANDLE_PROFILES.instagram}${handle}/`;
  return {
    url: clean.toString(),
    label: linkLabel(platform, handle, url.hostname),
    platform,
    handle,
  };
}

// A bare word with a dot is only a site when it has a scheme, `www.`, a path,
// or a familiar ending: "ryan.mitro" is an Instagram handle, not a domain.
const URL_PATTERN =
  /(?<![@\w.])(?:https?:\/\/[^\s]+|www\.[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s]*|(?:[a-z0-9-]+\.)+(?:com|net|org|dev|io|co|me|us|app|info|biz)\b)/gi;
const HANDLE_PATTERN =
  /\b(insta(?:gram)?|ig|x|twitter|tiktok)\b\s*[-:]?\s*@?([a-z0-9._]{2,30})|@([a-z0-9._]{2,30})/gi;

/**
 * Pull clickable profiles out of the form's free-text social answer. It holds
 * pasted URLs, bare domains, and lines such as "Insta: @ryansloan04" or
 * "Ryanvalley on insta"; anything unrecognisable stays in the note.
 */
export function parseSocialLinks(text: string): SocialLink[] {
  const links = new Map<string, SocialLink>();
  const withoutUrls = text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, " ")
    .replace(URL_PATTERN, (match) => {
      if (match.includes("@") && !match.includes("/")) return match;
      const link = linkFromUrl(match);
      if (link) links.set(link.url, link);
      return " ";
    });

  for (const match of withoutUrls.matchAll(HANDLE_PATTERN)) {
    const platformWord = match[1]?.toLowerCase();
    const handle = (match[2] ?? match[3]).replace(/\.$/, "").toLowerCase();
    const platform: SocialLink["platform"] =
      platformWord === "x" || platformWord === "twitter"
        ? "x"
        : platformWord === "tiktok"
          ? "tiktok"
          : "instagram";
    const url = `${HANDLE_PROFILES[platform]}${handle}${platform === "instagram" ? "/" : ""}`;
    links.set(url, { url, label: `@${handle}`, platform, handle });
  }

  // "Ryanvalley on insta": the handle comes first.
  for (const match of withoutUrls.matchAll(
    /\b([a-z0-9._]{2,30})\s+on\s+(insta(?:gram)?|ig)\b/gi,
  )) {
    const handle = match[1].toLowerCase();
    const url = `${HANDLE_PROFILES.instagram}${handle}/`;
    links.set(url, { url, label: `@${handle}`, platform: "instagram", handle });
  }
  return [...links.values()];
}

/** File IDs from the form's upload answer: comma-separated Drive open links. */
export function parseDriveFileIds(text: string) {
  return [
    ...new Set(
      [...text.matchAll(/[?&]id=([A-Za-z0-9_-]{10,})/g)].map(
        (match) => match[1],
      ),
    ),
  ];
}
