import { expect, test } from "@playwright/test";

import { getBaseballFixtures } from "@/lib/test-fixtures/baseball";
import {
  filterTeams,
  formatGameDate,
  getCityOptions,
  getSeasonRange,
  getStateOptions,
  haversineMiles,
  isValidZip,
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

test("zip validation accepts five digits only", () => {
  expect(isValidZip("05401")).toBe(true);
  expect(isValidZip(" 05401 ")).toBe(true);
  expect(isValidZip("5401")).toBe(false);
  expect(isValidZip("05401-1234")).toBe(false);
});
