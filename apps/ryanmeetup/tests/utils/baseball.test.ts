import { expect, test } from "@playwright/test";

import { getBaseballFixtures } from "@/lib/test-fixtures/baseball";
import {
  filterTeams,
  formatGameDate,
  getCityOptions,
  getSeasonRange,
  getSeasonStats,
  getStateName,
  getStateOptions,
  getZipCountry,
  hasTicketLink,
  haversineMiles,
  isPartialZip,
  isValidZip,
  matchesSearch,
  normalizeZip,
  sortByDate,
  teamsNearPoint,
  toCitySlug,
} from "@/utils/baseball";

const teams = getBaseballFixtures();
const slugs = (list: { slug: string }[]) => list.map((team) => team.slug);

test("a state with no team finds the team that serves it", () => {
  expect(slugs(filterTeams(teams, { state: "VT" }))).toEqual([
    "manchester-ryanlanders",
  ]);
  expect(slugs(filterTeams(teams, { state: "nh" }))).toEqual([
    "manchester-ryanlanders",
  ]);
});

test("served cities match by readable slug", () => {
  expect(slugs(filterTeams(teams, { city: "providence" }))).toEqual([
    "hartford-ryan-goats",
  ]);
  expect(toCitySlug("St. Paul")).toBe("st-paul");
});

test("filters combine with AND", () => {
  expect(filterTeams(teams, { state: "CT", date: "2027-06-12" })).toEqual([]);
  expect(slugs(filterTeams(teams, { date: "2027-07-10" })).sort()).toEqual([
    "columbus-clip-ryans",
    "sacramento-river-ryans",
  ]);
});

test("dropdown options include served places", () => {
  const states = getStateOptions(teams);
  expect(states).toContainEqual({ value: "VT", label: "Vermont" });
  expect(states.map((option) => option.label)).toEqual(
    [...states.map((option) => option.label)].sort((a, b) => a.localeCompare(b)),
  );
  expect(getCityOptions(teams)).toContainEqual({
    value: "burlington",
    label: "Burlington",
  });
});

test("game dates do not shift with the viewer's time zone", () => {
  expect(formatGameDate("2027-06-12")).toBe("Sat, Jun 12, 2027");
  expect(getSeasonRange(teams)).toBe("Jun 12 – Jul 10, 2027");
  expect(getSeasonRange([])).toBeNull();
});

test("sortByDate breaks ties by name", () => {
  const sorted = slugs(sortByDate(teams));
  expect(sorted.slice(-2)).toEqual([
    "columbus-clip-ryans",
    "sacramento-river-ryans",
  ]);
});

test("haversine distance is roughly right", () => {
  // Worcester to Manchester, NH is about 50 miles as the crow flies.
  const miles = haversineMiles(
    { lat: 42.2626, lon: -71.8023 },
    { lat: 42.9956, lon: -71.4548 },
  );
  expect(miles).toBeGreaterThan(45);
  expect(miles).toBeLessThan(60);
});

test("zip search returns teams in range, nearest first", () => {
  const { results, outOfRange } = teamsNearPoint(teams, {
    lat: 42.2626,
    lon: -71.8023,
  });
  expect(outOfRange).toBe(false);
  expect(results[0].team.slug).toBe("worcester-ryan-sox");
  expect(results.every((entry) => (entry.distance ?? 0) <= 120)).toBe(true);
  expect(slugs(results.map((entry) => entry.team))).not.toContain(
    "columbus-clip-ryans",
  );
});

test("zip search falls back to the nearest teams when none are in range", () => {
  const { results, outOfRange } = teamsNearPoint(teams, {
    lat: 44.4759,
    lon: -73.2121,
  });
  expect(outOfRange).toBe(true);
  expect(results).toHaveLength(2);
  expect(results[0].distance).toBeGreaterThan(120);
});

test("zip validation accepts five digits or a full postal code", () => {
  expect(isValidZip("05401")).toBe(true);
  expect(isValidZip(" 05401 ")).toBe(true);
  expect(isValidZip("5401")).toBe(false);
  expect(isValidZip("05401-1234")).toBe(false);
  expect(isValidZip("V6B 1A1")).toBe(true);
  expect(isValidZip("v6b1a1")).toBe(true);
  expect(isValidZip("V6B 1A")).toBe(false);
  // D never starts a postal code.
  expect(isValidZip("D6B 1A1")).toBe(false);
});

test("postal codes share one spelling and look up in Canada", () => {
  expect(normalizeZip("v6b1a1")).toBe("V6B 1A1");
  expect(normalizeZip(" V6B-1A1 ")).toBe("V6B 1A1");
  expect(normalizeZip(" 05401 ")).toBe("05401");
  expect(getZipCountry("V6B 1A1")).toBe("ca");
  expect(getZipCountry("05401")).toBe("us");
});

test("tbd.com and blank ticket links don't count as real tickets", () => {
  const withUrl = (ticketUrl: string) => ({ ...teams[0], ticketUrl });
  expect(hasTicketLink(withUrl("https://example.com/tickets"))).toBe(true);
  expect(hasTicketLink(withUrl("example.com/tickets"))).toBe(true);
  expect(hasTicketLink(withUrl("https://tbd.com"))).toBe(false);
  expect(hasTicketLink(withUrl("https://www.TBD.com/tickets"))).toBe(false);
  expect(hasTicketLink(withUrl("tbd.com"))).toBe(false);
  expect(hasTicketLink(withUrl(""))).toBe(false);
});

test("free-text search needs every word to match a name or place", () => {
  const find = (query: string) =>
    slugs(teams.filter((team) => matchesSearch(team, query)));
  expect(find("")).toHaveLength(teams.length);
  expect(find("Ryan Sox")).toEqual(["worcester-ryan-sox"]);
  expect(find("worcester massachusetts")).toEqual(["worcester-ryan-sox"]);
  expect(find("riverside")).toEqual(["manchester-ryanlanders"]);
  // Served states and cities count too.
  expect(find("vermont")).toEqual(["manchester-ryanlanders"]);
  expect(find("burlington")).toEqual(["manchester-ryanlanders"]);
  expect(find("worcester vermont")).toEqual([]);
});

test("a few digits or a postal prefix read as a code still being typed", () => {
  expect(isPartialZip("031")).toBe(true);
  expect(isPartialZip("03101")).toBe(false);
  expect(isPartialZip("ryan")).toBe(false);
  expect(isPartialZip("V6B")).toBe(true);
  expect(isPartialZip("V6B 1A")).toBe(true);
  expect(isPartialZip("V6B 1A1")).toBe(false);
  expect(isPartialZip("Vancouver")).toBe(false);
});

test("season stats count teams, host states, countries, and distinct nights", () => {
  expect(getSeasonStats(teams)).toEqual({ teams: 6, states: 6, countries: 1, nights: 5 });
  expect(getSeasonStats([])).toEqual({ teams: 0, states: 0, countries: 0, nights: 0 });
  // A Canadian team adds a country, not a state.
  const vancouver = { ...teams[0], slug: "vancouver", state: "BC" };
  expect(getSeasonStats([...teams, vancouver])).toMatchObject({ states: 6, countries: 2 });
});

test("provinces read as their full names", () => {
  expect(getStateName("BC")).toBe("British Columbia");
  expect(getStateName("nh")).toBe("New Hampshire");
  expect(getStateOptions([{ ...teams[0], state: "BC", servesStates: [] }])).toEqual([
    { value: "BC", label: "British Columbia" },
  ]);
});

test("states and provinces group by country once both are listed", () => {
  const options = getStateOptions([
    ...teams,
    { ...teams[0], slug: "vancouver", state: "BC", servesStates: [] },
  ]);
  expect(options.at(-1)).toEqual({
    value: "BC",
    label: "British Columbia",
    group: { label: "Canada" },
  });
  expect(options[0].group).toEqual({ label: "United States" });
  // Without a province, there's nothing to group.
  expect(getStateOptions(teams).every((option) => !("group" in option))).toBe(true);
});
