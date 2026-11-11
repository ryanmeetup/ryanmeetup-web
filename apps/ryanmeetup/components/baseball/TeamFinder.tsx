"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClearFiltersButton,
  DropdownSelect,
  EmptyState,
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
  isValidZip,
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
const ZIP_DEBOUNCE_MS = 400;

const TeamFinder = ({ teams }: TeamFinderProps) => {
  const [state, setState] = useQueryParamState("state", ALL);
  const [city, setCity] = useQueryParamState("city", ALL);
  const [team, setTeam] = useQueryParamState("team", ALL);
  const [date, setDate] = useQueryParamState("date", ALL);
  const [urlZip, setUrlZip] = useQueryParamState("zip");
  const [zipInput, setZipInput] = useState(urlZip);
  const [geocode, setGeocode] = useState<GeocodeResult | null>(null);

  // Keep the field in step with the URL when it changes elsewhere (back
  // button, Clear filters, a shared link).
  useEffect(() => {
    setZipInput(urlZip);
  }, [urlZip]);

  // The field updates on every keystroke; the URL and the search follow once
  // the reader has stopped typing a complete zip (or cleared it).
  useEffect(() => {
    const next = zipInput.trim();
    if (next === urlZip || (next && !isValidZip(next))) return;

    const timer = window.setTimeout(() => setUrlZip(next), ZIP_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [setUrlZip, urlZip, zipInput]);

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
          setGeocode({ zip: urlZip, error: body.error ?? "We couldn't find that zip code." });
          return;
        }
        setGeocode({ zip: urlZip, point: { lat: body.lat, lon: body.lon }, label: body.label });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setGeocode({ zip: urlZip, error: "Zip search isn't available right now." });
      });

    return () => controller.abort();
  }, [urlZip]);

  // Only trust a lookup for the zip that's actually in the URL.
  const activeGeocode = geocode?.zip === urlZip && isValidZip(urlZip) ? geocode : null;
  const typedPartialZip = zipInput.trim() !== "" && !isValidZip(zipInput);
  const isPending =
    (!typedPartialZip && zipInput.trim() !== urlZip) ||
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
    });

    if (activeGeocode?.point) {
      return teamsNearPoint(filtered, activeGeocode.point);
    }
    return { results: sortByDate(filtered).map((entry) => ({ team: entry })), outOfRange: false };
  }, [activeGeocode, city, date, state, team, teams]);

  const hasFilters =
    state !== ALL || city !== ALL || team !== ALL || date !== ALL || urlZip !== "";

  const clearFilters = () => {
    setState(ALL);
    setCity(ALL);
    setTeam(ALL);
    setDate(ALL);
    setUrlZip("");
    setZipInput("");
  };

  const servesNoteFor = (entry: BaseballTeam) => {
    if (state !== ALL && entry.state.toUpperCase() !== state.toUpperCase()) {
      return `Closest team for ${getStateName(state)}`;
    }
    if (city !== ALL && toCitySlug(entry.city) !== city) {
      const label = cityOptions.find((option) => option.value === city)?.label ?? city;
      return `Closest team for ${label}`;
    }
    return undefined;
  };

  const zipStatus = (() => {
    if (typedPartialZip) return "Enter all five digits of your zip code.";
    if (activeGeocode?.error) return activeGeocode.error;
    if (!activeGeocode?.point) return null;
    const place = activeGeocode.label ?? urlZip;
    if (outOfRange) {
      return `No teams within ${ZIP_SEARCH_RADIUS_MILES} miles of ${place}. These are the closest.`;
    }
    return `Teams within ${ZIP_SEARCH_RADIUS_MILES} miles of ${place}, closest first.`;
  })();

  const filterOption = (label: string) => ({ label, value: ALL });

  return (
    <section id="find" className="scroll-mt-28 space-y-6">
      <SectionHeader
        title="Find your Ryan night"
        description="Search by zip code, or narrow the list by state, city, team, or date. Nearby states without a team show the closest one."
      />

      <div className="space-y-4">
        <form
          role="search"
          aria-label="Find a team near you"
          onSubmit={(event) => {
            event.preventDefault();
            const next = zipInput.trim();
            if (isValidZip(next) || next === "") setUrlZip(next);
          }}
          className="max-w-md"
        >
          <SearchInput
            label="Zip code"
            name="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="Your zip code, e.g. 03101"
            value={zipInput}
            onChange={(event) => setZipInput(event.target.value.replace(/\D/g, ""))}
            pending={isPending}
            pendingLabel="Finding nearby teams"
          />
        </form>

        <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-wrap lg:items-center">
          <DropdownSelect
            label="State"
            value={state}
            active={state !== ALL}
            options={[filterOption("All states"), ...stateOptions]}
            onChange={setState}
          />
          <DropdownSelect
            label="City"
            value={city}
            active={city !== ALL}
            options={[filterOption("All cities"), ...cityOptions]}
            onChange={setCity}
          />
          <DropdownSelect
            label="Team"
            value={team}
            active={team !== ALL}
            options={[filterOption("All teams"), ...teamOptions]}
            onChange={setTeam}
            menuWidth="wide"
          />
          <DropdownSelect
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
          <p role="status" className="text-sm text-black/70 dark:text-white/70">
            {zipStatus}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <PendingResults pending={isPending} label="Finding nearby teams" surface="page">
          {results.length === 0 ? (
            <EmptyState message="No teams match those filters yet." />
          ) : (
            <ul className="space-y-4" aria-label={`${results.length} ${results.length === 1 ? "team" : "teams"}`}>
              {results.map(({ team: entry, distance }) => (
                <li key={entry.slug}>
                  <TeamCard team={entry} distance={distance} servesNote={servesNoteFor(entry)} />
                </li>
              ))}
            </ul>
          )}
        </PendingResults>
        <div className="xl:sticky xl:top-28">
          <TeamMap teams={results.map((entry) => entry.team)} />
        </div>
      </div>
    </section>
  );
};

export { TeamFinder };
