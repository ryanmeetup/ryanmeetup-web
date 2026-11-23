"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClearFiltersButton,
  DropdownSelect,
  EmptyState,
  Pagination,
  PendingResults,
  SearchInput,
  SectionHeader,
} from "@ryanmeetup/ui";
import { useQueryParamState } from "@ryanmeetup/hooks";

import type { BaseballTeam } from "@/lib/types";
import {
  ZIP_SEARCH_RADIUS_MILES,
  filterTeams,
  getCityOptions,
  getDateOptions,
  getStateName,
  getStateOptions,
  getTeamOptions,
  isPartialZip,
  isValidZip,
  matchesSearch,
  normalizeZip,
  sortByDate,
  teamsNearPoint,
  toCitySlug,
  type LatLon,
  type TeamWithDistance,
} from "@/utils/baseball";
import { TeamCard } from "./TeamCard";
import { TeamMap } from "./TeamMap";

type TeamFinderProps = {
  teams: BaseballTeam[];
};

type GeocodeResult = {
  zip: string;
  point?: LatLon;
  label?: string;
  error?: string;
};

const ALL = "all";
const SEARCH_DEBOUNCE_MS = 400;
// The search field and filter buttons share one height so the row lines up.
const FILTER_HEIGHT = "h-10";
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

/**
 * The `q` value for the search field, or null while a zip or postal code is
 * half typed. A full code runs the nearby search; anything else matches names
 * and places.
 */
const getSearchQuery = (value: string): string | null => {
  const next = value.trim();
  return isPartialZip(next) ? null : next;
};

const TeamFinder = ({ teams }: TeamFinderProps) => {
  const [pageParam, setPageParam] = useQueryParamState("page", "1");
  const [perPageParam, setPerPageParam] = useQueryParamState(
    "perPage",
    String(DEFAULT_PAGE_SIZE),
  );
  // Any change to what's being searched starts the list back on page one.
  const resetPage = () => setPageParam("1");
  const withPageReset =
    (setter: (value: string) => void) => (value: string) => {
      setter(value);
      resetPage();
    };
  const [state, setStateParam] = useQueryParamState("state", ALL);
  const [city, setCityParam] = useQueryParamState("city", ALL);
  const [team, setTeamParam] = useQueryParamState("team", ALL);
  const [date, setDateParam] = useQueryParamState("date", ALL);
  const [legacyZip, setLegacyZip] = useQueryParamState("zip");
  const [urlQuery, setUrlQueryParam] = useQueryParamState("q");
  const setState = withPageReset(setStateParam);
  const setCity = withPageReset(setCityParam);
  const setTeam = withPageReset(setTeamParam);
  const setDate = withPageReset(setDateParam);
  const [searchInput, setSearchInput] = useState(urlQuery || legacyZip);
  const [geocode, setGeocode] = useState<GeocodeResult | null>(null);
  const urlZip = isValidZip(urlQuery) ? normalizeZip(urlQuery) : "";
  const textQuery = urlZip ? "" : urlQuery;

  const applySearch = (query: string) => {
    setUrlQueryParam(query);
    resetPage();
  };

  // Links from before search moved to `q` used `?zip=`; fold them in so
  // those bookmarks keep working.
  useEffect(() => {
    if (!legacyZip) return;
    if (!urlQuery) setUrlQueryParam(legacyZip);
    setLegacyZip("");
  }, [legacyZip, setLegacyZip, setUrlQueryParam, urlQuery]);

  // Keep the field in step with the URL when it changes elsewhere (back
  // button, Clear filters, a shared link), without trimming what the reader
  // is mid-way through typing.
  useEffect(() => {
    setSearchInput((current) =>
      getSearchQuery(current) === urlQuery ? current : urlQuery,
    );
  }, [urlQuery]);

  // The field updates on every keystroke; the URL and the results follow
  // once the reader stops typing.
  useEffect(() => {
    const next = getSearchQuery(searchInput);
    if (next === null || next === urlQuery) return;

    const timer = window.setTimeout(() => {
      setUrlQueryParam(next);
      setPageParam("1");
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, setPageParam, setUrlQueryParam, urlQuery]);

  useEffect(() => {
    if (!isValidZip(urlZip)) return;

    const controller = new AbortController();
    fetch(`/api/baseball/geocode?zip=${encodeURIComponent(urlZip)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          lat?: number;
          lon?: number;
          label?: string;
          error?: string;
        };
        if (!response.ok || body.lat === undefined || body.lon === undefined) {
          setGeocode({ zip: urlZip, error: body.error ?? "We couldn't find that code." });
          return;
        }
        setGeocode({ zip: urlZip, point: { lat: body.lat, lon: body.lon }, label: body.label });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setGeocode({ zip: urlZip, error: "Location search isn't available right now." });
      });

    return () => controller.abort();
  }, [urlZip]);

  // Only trust a lookup for the zip that's actually in the URL.
  const activeGeocode = geocode?.zip === urlZip && isValidZip(urlZip) ? geocode : null;
  const pendingQuery = getSearchQuery(searchInput);
  const typedPartialZip = pendingQuery === null;
  const isPending =
    (pendingQuery !== null && pendingQuery !== urlQuery) ||
    (isValidZip(urlZip) && !activeGeocode);

  const stateOptions = useMemo(() => getStateOptions(teams), [teams]);
  const cityOptions = useMemo(() => getCityOptions(teams), [teams]);
  const teamOptions = useMemo(() => getTeamOptions(teams), [teams]);
  const dateOptions = useMemo(() => getDateOptions(teams), [teams]);

  const { results, outOfRange } = useMemo((): {
    results: TeamWithDistance[];
    outOfRange: boolean;
  } => {
    const filtered = filterTeams(teams, {
      state: state === ALL ? undefined : state,
      city: city === ALL ? undefined : city,
      team: team === ALL ? undefined : team,
      date: date === ALL ? undefined : date,
    }).filter((entry) => matchesSearch(entry, textQuery));

    if (activeGeocode?.point) {
      return teamsNearPoint(filtered, activeGeocode.point);
    }
    return { results: sortByDate(filtered).map((entry) => ({ team: entry })), outOfRange: false };
  }, [activeGeocode, city, date, state, team, teams, textQuery]);

  const parsedPerPage = Number.parseInt(perPageParam, 10);
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(
    parsedPerPage,
  )
    ? parsedPerPage
    : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  // Clamp rather than rewrite the URL, so a stale ?page= still shows something.
  const page = Math.min(
    Math.max(1, Number.parseInt(pageParam, 10) || 1),
    totalPages,
  );
  const pagedResults = results.slice((page - 1) * pageSize, page * pageSize);
  const showPagination = results.length > DEFAULT_PAGE_SIZE;

  const scrollToResults = () =>
    document.getElementById("find-results")?.scrollIntoView({ block: "start" });

  const hasFilters =
    state !== ALL ||
    city !== ALL ||
    team !== ALL ||
    date !== ALL ||
    urlQuery !== "";

  const clearFilters = () => {
    setState(ALL);
    setCity(ALL);
    setTeam(ALL);
    setDate(ALL);
    applySearch("");
    setSearchInput("");
  };

  const servesNoteFor = (entry: BaseballTeam) => {
    if (state !== ALL && entry.state.toUpperCase() !== state.toUpperCase()) {
      return `Serving ${getStateName(state)}`;
    }
    if (city !== ALL && toCitySlug(entry.city) !== city) {
      const label = cityOptions.find((option) => option.value === city)?.label ?? city;
      return `Serving ${label}`;
    }
    return undefined;
  };

  const zipStatus = (() => {
    if (typedPartialZip) {
      return /^\d/.test(searchInput.trim())
        ? "Enter all five digits of your zip code."
        : "Enter your full postal code, like V6B 1A1.";
    }
    if (activeGeocode?.error) return activeGeocode.error;
    if (!activeGeocode?.point) return null;
    const place = activeGeocode.label ?? urlZip;
    if (outOfRange) {
      return `No teams within ${ZIP_SEARCH_RADIUS_MILES} miles of ${place}. Here are the nearest ones.`;
    }
    return `Teams within ${ZIP_SEARCH_RADIUS_MILES} miles of ${place}.`;
  })();

  const filterOption = (label: string) => ({ label, value: ALL });

  return (
    <section id="find" className="scroll-mt-28 space-y-6">
      <SectionHeader
        title="Find your Ryan night"
        description="Search by team, city, state, or zip/postal code, or narrow the list with the filters."
      />

      {/* Search and filters share a row once there is room for both. */}
      <div className="flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-center">
        <form
          role="search"
          aria-label="Find a team near you"
          onSubmit={(event) => {
            event.preventDefault();
            if (pendingQuery !== null) applySearch(pendingQuery);
          }}
          className="w-full max-w-md xl:w-96 xl:flex-none"
        >
          <SearchInput
            label="Search teams"
            name="q"
            autoComplete="off"
            placeholder="Search by team, city, state, or zip/postal code..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            inputClassName={FILTER_HEIGHT}
            pending={isPending}
            pendingLabel="Searching teams"
          />
        </form>

        <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-wrap lg:items-center xl:min-w-0 xl:flex-1 xl:basis-0">
          <DropdownSelect
            className={FILTER_HEIGHT}
            label="State/province"
            menuWidth="wide"
            value={state}
            active={state !== ALL}
            options={[filterOption("All"), ...stateOptions]}
            onChange={setState}
          />
          <DropdownSelect
            className={FILTER_HEIGHT}
            label="City"
            value={city}
            active={city !== ALL}
            options={[filterOption("All cities"), ...cityOptions]}
            onChange={setCity}
          />
          <DropdownSelect
            className={FILTER_HEIGHT}
            label="Team"
            value={team}
            active={team !== ALL}
            options={[filterOption("All teams"), ...teamOptions]}
            onChange={setTeam}
            menuWidth="wide"
          />
          <DropdownSelect
            className={FILTER_HEIGHT}
            label="Date"
            value={date}
            active={date !== ALL}
            options={[filterOption("All dates"), ...dateOptions]}
            onChange={setDate}
          />
          {hasFilters && (
            <ClearFiltersButton onClick={clearFilters} className="col-span-2 justify-self-start" />
          )}
        </div>

        {zipStatus && (
          <p role="status" className="text-sm text-black/70 xl:basis-full dark:text-white/70">
            {zipStatus}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <PendingResults pending={isPending} label="Finding nearby teams" surface="page">
          {results.length === 0 ? (
            <EmptyState message="No teams match those filters yet." />
          ) : (
            <div id="find-results" className="scroll-mt-28 space-y-4">
              <ul className="space-y-4" aria-label={`${results.length} ${results.length === 1 ? "team" : "teams"}`}>
                {pagedResults.map(({ team: entry, distance }) => (
                  <li key={entry.slug}>
                    <TeamCard team={entry} distance={distance} servesNote={servesNoteFor(entry)} />
                  </li>
                ))}
              </ul>
              {showPagination && (
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  totalCount={results.length}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  itemLabel="teams"
                  itemLabelSingular="team"
                  disabled={isPending}
                  onPageChange={(next) => {
                    setPageParam(String(next));
                    scrollToResults();
                  }}
                  onPageSizeChange={(next) => {
                    setPerPageParam(String(next));
                    resetPage();
                  }}
                />
              )}
            </div>
          )}
        </PendingResults>
        {/* Above the list on narrower screens, so "See the map" lands on it
            rather than past every team card. */}
        <div id="map" className="order-first scroll-mt-28 xl:sticky xl:top-28 xl:order-none">
          <TeamMap teams={results.map((entry) => entry.team)} />
        </div>
      </div>
    </section>
  );
};

export { TeamFinder };
