"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Popup, type MapRef } from "react-map-gl/mapbox";
import NextImage from "next/image";
import { Heading } from "@ryanmeetup/ui";

import "mapbox-gl/dist/mapbox-gl.css";
import type { BaseballTeam } from "@/lib/types";
import {
  formatGameDate,
  getStateName,
  getTeamLogoSrc,
  hasTicketLink,
} from "@/utils/baseball";

type TeamMapProps = {
  teams: BaseballTeam[];
};

const MAP_HEIGHT = "h-[420px] sm:h-[520px]";
const MARKER_SIZE = 40;
const US_VIEW = { latitude: 39.5, longitude: -98.35, zoom: 3 };

// Matches the marker treatment on /map so the two maps read as one family.
const MARKER_CLASS =
  "flex items-center justify-center overflow-hidden rounded-full border border-black/15 bg-white shadow-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 motion-reduce:transition-none";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TeamMap = ({ teams }: TeamMapProps) => {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const isTestMode = process.env.NEXT_PUBLIC_E2E_TESTS === "true";
  const mapRef = useRef<MapRef>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // A popup for a team the filters just removed would point at nothing.
  const selected = useMemo(
    () => teams.find((team) => team.slug === selectedSlug) ?? null,
    [selectedSlug, teams],
  );

  const bounds = useMemo(() => {
    if (teams.length === 0) return null;
    const lats = teams.map((team) => team.coordinates.lat);
    const lons = teams.map((team) => team.coordinates.lon);
    return [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ] as [[number, number], [number, number]];
  }, [teams]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const duration = prefersReducedMotion() ? 0 : 800;

    if (!bounds) {
      map.flyTo({ center: [US_VIEW.longitude, US_VIEW.latitude], zoom: US_VIEW.zoom, duration });
      return;
    }
    map.fitBounds(bounds, { padding: 64, maxZoom: 7, duration });
  }, [bounds]);

  if (isTestMode) {
    return (
      <div data-testid="baseball-map" className="space-y-1 rounded-2xl border border-black/10 p-4 dark:border-white/10">
        {teams.map((team) => (
          <div key={team.slug} data-testid="baseball-marker">
            {team.name}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-black/10 shadow-drop dark:border-white/10 ${MAP_HEIGHT}`}
    >
      <p className="sr-only">
        Map of Baseball Classic teams. The list of teams on this page has the
        same information.
      </p>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={US_VIEW}
        mapStyle="mapbox://styles/mapbox/streets-v9"
        onLoad={() => {
          if (bounds) mapRef.current?.fitBounds(bounds, { padding: 64, maxZoom: 7, duration: 0 });
        }}
      >
        {teams.map((team) => {
          const logo = getTeamLogoSrc(team);
          return (
            <Marker
              key={team.slug}
              latitude={team.coordinates.lat}
              longitude={team.coordinates.lon}
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                setSelectedSlug(team.slug);
              }}
            >
              <button
                type="button"
                className={MARKER_CLASS}
                style={{ width: MARKER_SIZE, height: MARKER_SIZE }}
                aria-label={`${team.name}, ${formatGameDate(team.gameDate)}`}
                aria-expanded={selected?.slug === team.slug}
                onMouseEnter={() => setSelectedSlug(team.slug)}
                onFocus={() => setSelectedSlug(team.slug)}
              >
                {logo && (
                  <NextImage
                    src={logo}
                    alt=""
                    width={MARKER_SIZE - 8}
                    height={MARKER_SIZE - 8}
                    className="object-contain"
                  />
                )}
              </button>
            </Marker>
          );
        })}

        {selected && (
          <Popup
            latitude={selected.coordinates.lat}
            longitude={selected.coordinates.lon}
            offset={MARKER_SIZE / 2 + 4}
            onClose={() => setSelectedSlug(null)}
            closeOnClick
            className="map-popup"
          >
            <div className="flex max-w-56 flex-col items-start gap-2 rounded-[20px] bg-white p-4 text-black">
              {getTeamLogoSrc(selected) && (
                <NextImage
                  src={getTeamLogoSrc(selected) as string}
                  alt={`${selected.name} logo`}
                  width={64}
                  height={64}
                  className="object-contain"
                />
              )}
              <Heading className="text-base text-black" size="h3" ignoreColorMode>
                {selected.name}
              </Heading>
              <p className="text-xs leading-relaxed text-black/70">
                {formatGameDate(selected.gameDate)}
                <br />
                {selected.city}, {getStateName(selected.state)}
              </p>
              {hasTicketLink(selected) ? (
                <a
                  href={selected.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-black underline underline-offset-4 transition hover:text-black/70"
                >
                  Get tickets
                  <span className="sr-only"> for {selected.name} (opens in a new tab)</span>
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="cursor-not-allowed text-sm font-semibold text-black/50"
                >
                  Tickets soon
                  <span className="sr-only"> for {selected.name}: not on sale yet</span>
                </span>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
};

export { TeamMap };
