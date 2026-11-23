import { convertImageUrl } from "@ryanmeetup/utils";

import type { BaseballTeam } from "@/lib/types";

type LatLon = { lat: number; lon: number };

type BaseballFilters = {
  state?: string;
  city?: string;
  team?: string;
  date?: string;
};

type TeamWithDistance = {
  team: BaseballTeam;
  /** Miles from the searched zip, when a zip search is active. */
  distance?: number;
};

type NearbyResult = {
  results: TeamWithDistance[];
  /** True when nothing fell inside the radius and `results` are the nearest teams instead. */
  outOfRange: boolean;
};

const ZIP_SEARCH_RADIUS_MILES = 120;
const NEAREST_FALLBACK_COUNT = 2;
const EARTH_RADIUS_MILES = 3958.8;

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// Teams north of the border store their province's postal code in `state`.
const PROVINCE_NAMES: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories",
  NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
  SK: "Saskatchewan", YT: "Yukon",
};

const normalize = (value: string) => value.trim().toLowerCase();

/** Readable, shareable query value for a city: "St. Paul" → "st-paul". */
const toCitySlug = (city: string) =>
  normalize(city)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

/** Full name for a US state or Canadian province code; unknown codes pass through. */
const getStateName = (code: string) => {
  const key = code.trim().toUpperCase();
  return STATE_NAMES[key] ?? PROVINCE_NAMES[key] ?? code;
};

const isProvince = (code: string) => code.trim().toUpperCase() in PROVINCE_NAMES;

const matchesState = (team: BaseballTeam, state: string) => {
  const code = state.trim().toUpperCase();
  return (
    team.state.toUpperCase() === code ||
    (team.servesStates ?? []).some((served) => served.toUpperCase() === code)
  );
};

const matchesCity = (team: BaseballTeam, citySlug: string) =>
  toCitySlug(team.city) === citySlug ||
  (team.servesCities ?? []).some((served) => toCitySlug(served) === citySlug);

const filterTeams = (teams: BaseballTeam[], filters: BaseballFilters) =>
  teams.filter((team) => {
    if (filters.state && !matchesState(team, filters.state)) return false;
    if (filters.city && !matchesCity(team, filters.city)) return false;
    if (filters.team && team.slug !== filters.team) return false;
    if (filters.date && team.gameDate.slice(0, 10) !== filters.date) {
      return false;
    }
    return true;
  });

// Canadian postal codes ("V6B 1A1") skip letters that read like digits: the
// first letter never uses D F I O Q U W Z, later ones never D F I O Q U.
const POSTAL_FIRST = "[ABCEGHJ-NPRSTVXY]";
const POSTAL_LETTER = "[ABCEGHJ-NPRSTV-Z]";
const POSTAL_CODE = new RegExp(`^${POSTAL_FIRST}\\d${POSTAL_LETTER}[ -]?\\d${POSTAL_LETTER}\\d$`, "i");
// Two to five characters of one, e.g. "V6" or "V6B 1A".
const PARTIAL_POSTAL_CODE = new RegExp(
  `^${POSTAL_FIRST}\\d(?:${POSTAL_LETTER}(?:[ -]?(?:\\d${POSTAL_LETTER}?)?)?)?$`,
  "i",
);

/** True when a free-text search looks like the start of a zip or postal code. */
const isPartialZip = (value: string) => {
  const next = value.trim();
  return /^\d{1,4}$/.test(next) || PARTIAL_POSTAL_CODE.test(next);
};

/**
 * Free-text search across a team's name, stadium, city, and state, including
 * the places it serves. Every word must match somewhere, so "worcester ma"
 * narrows rather than widens.
 */
const matchesSearch = (team: BaseballTeam, query: string) => {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const states = [team.state, ...(team.servesStates ?? [])];
  const haystack = normalize(
    [
      team.name,
      team.venue,
      team.city,
      ...(team.servesCities ?? []),
      ...states,
      ...states.map(getStateName),
    ]
      .filter(Boolean)
      .join(" "),
  );
  return words.every((word) => haystack.includes(word));
};

/**
 * Headline counts for the hero, all derived from announced teams. `states`
 * counts US states only; a province adds to `countries` instead.
 */
const getSeasonStats = (teams: BaseballTeam[]) => {
  const regions = new Set(teams.map((team) => team.state.trim().toUpperCase()));
  const codes = Array.from(regions);
  return {
    teams: teams.length,
    states: codes.filter((code) => !isProvince(code)).length,
    countries: new Set(codes.map((code) => (isProvince(code) ? "CA" : "US"))).size,
    nights: new Set(teams.map((team) => team.gameDate.slice(0, 10))).size,
  };
};

const sortByDate = (teams: BaseballTeam[]) =>
  [...teams].sort(
    (a, b) =>
      a.gameDate.localeCompare(b.gameDate) || a.name.localeCompare(b.name),
  );

/**
 * States and provinces with a team, plus those a team covers, so Vermont is
 * selectable without a Vermont team. Grouped by country once both appear.
 */
const getStateOptions = (teams: BaseballTeam[]) => {
  const codes = new Set<string>();
  teams.forEach((team) => {
    codes.add(team.state.toUpperCase());
    (team.servesStates ?? []).forEach((state) => codes.add(state.toUpperCase()));
  });

  const options = Array.from(codes)
    .map((code) => ({
      value: code,
      label: getStateName(code),
      province: isProvince(code),
    }))
    // US states first, then provinces, each alphabetical.
    .sort(
      (a, b) =>
        Number(a.province) - Number(b.province) || a.label.localeCompare(b.label),
    );

  // Country headers only earn their place once both countries are listed.
  const grouped = new Set(options.map((option) => option.province)).size > 1;
  return options.map(({ value, label, province }) => ({
    value,
    label,
    ...(grouped
      ? { group: { label: province ? "Canada" : "United States" } }
      : {}),
  }));
};

const getCityOptions = (teams: BaseballTeam[]) => {
  const cities = new Map<string, string>();
  teams.forEach((team) => {
    [team.city, ...(team.servesCities ?? [])].forEach((city) => {
      const slug = toCitySlug(city);
      if (slug && !cities.has(slug)) cities.set(slug, city.trim());
    });
  });

  return Array.from(cities, ([value, label]) => ({ value, label })).sort(
    (a, b) => a.label.localeCompare(b.label),
  );
};

const getTeamOptions = (teams: BaseballTeam[]) =>
  [...teams]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((team) => ({ value: team.slug, label: team.name }));

const getDateOptions = (teams: BaseballTeam[]) =>
  Array.from(new Set(teams.map((team) => team.gameDate.slice(0, 10))))
    .sort()
    .map((date) => ({ value: date, label: formatGameDate(date) }));

/** Formats a calendar date without letting the viewer's time zone shift the day. */
const formatGameDate = (
  date: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  },
) => {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
};

/** "Jun 12 – Jul 10, 2027" from the announced game dates, or null with none. */
const getSeasonRange = (teams: BaseballTeam[]) => {
  const dates = teams.map((team) => team.gameDate.slice(0, 10)).sort();
  if (dates.length === 0) return null;

  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first === last) {
    return formatGameDate(first, { month: "long", day: "numeric", year: "numeric" });
  }

  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const start = formatGameDate(first, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const end = formatGameDate(last, { month: "short", day: "numeric", year: "numeric" });
  return `${start} – ${end}`;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineMiles = (a: LatLon, b: LatLon) => {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
};

/**
 * Teams within `radius` miles of `point`, nearest first. When none are in
 * range, the nearest few are returned and flagged, so a Ryan far from every
 * ballpark still learns where the closest game is.
 */
const teamsNearPoint = (
  teams: BaseballTeam[],
  point: LatLon,
  radius = ZIP_SEARCH_RADIUS_MILES,
): NearbyResult => {
  const withDistance = teams
    .map((team) => ({ team, distance: haversineMiles(point, team.coordinates) }))
    .sort((a, b) => a.distance - b.distance);

  const inRange = withDistance.filter((entry) => entry.distance <= radius);
  if (inRange.length > 0 || withDistance.length === 0) {
    return { results: inRange, outOfRange: false };
  }

  return {
    results: withDistance.slice(0, NEAREST_FALLBACK_COUNT),
    outOfRange: true,
  };
};

/** A five-digit US zip code or a full Canadian postal code. */
const isValidZip = (zip: string) => {
  const next = zip.trim();
  return /^\d{5}$/.test(next) || POSTAL_CODE.test(next);
};

/** Which country a valid code belongs to, so the geocoder looks in the right place. */
const getZipCountry = (zip: string): "us" | "ca" =>
  /^\d{5}$/.test(zip.trim()) ? "us" : "ca";

/** One spelling per code, so "v6b1a1" and "V6B 1A1" share a lookup: "V6B 1A1". */
const normalizeZip = (zip: string) => {
  const next = zip.trim().toUpperCase();
  return POSTAL_CODE.test(next)
    ? `${next.slice(0, 3)} ${next.slice(-3)}`
    : next;
};

/** Contentful asset URLs are protocol-relative; local fixture paths are not. */
const getTeamLogoSrc = (team: BaseballTeam) => {
  const url = team.logo?.fields?.file?.url;
  if (!url) return undefined;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return convertImageUrl(team.logo);
};

// Hosts that stand in for a ticket link that hasn't been set up yet.
const PLACEHOLDER_TICKET_HOSTS = ["tbd.com"];

/** True once a team has a real ticket link rather than a blank or tbd.com stand-in. */
const hasTicketLink = (team: BaseballTeam) => {
  const raw = team.ticketUrl?.trim();
  if (!raw) return false;
  try {
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return !PLACEHOLDER_TICKET_HOSTS.some(
      (placeholder) => host === placeholder || host.endsWith(`.${placeholder}`),
    );
  } catch {
    return false;
  }
};

export {
  NEAREST_FALLBACK_COUNT,
  ZIP_SEARCH_RADIUS_MILES,
  filterTeams,
  formatGameDate,
  getCityOptions,
  getDateOptions,
  getSeasonRange,
  getSeasonStats,
  getStateName,
  getStateOptions,
  getTeamLogoSrc,
  getTeamOptions,
  getZipCountry,
  hasTicketLink,
  haversineMiles,
  isPartialZip,
  isValidZip,
  matchesCity,
  matchesSearch,
  matchesState,
  normalizeZip,
  sortByDate,
  teamsNearPoint,
  toCitySlug,
};
export type { BaseballFilters, LatLon, NearbyResult, TeamWithDistance };
