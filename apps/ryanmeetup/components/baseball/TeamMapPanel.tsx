"use client";

import { useEffect, useState } from "react";
import { Button } from "@ryanmeetup/ui";
import { FiChevronDown, FiMap } from "react-icons/fi";

import type { BaseballTeam } from "@/lib/types";
import { TeamMap } from "./TeamMap";

/** Keep mobile results first, with the map shown below them until someone hides it. */
const TeamMapPanel = ({ teams }: { teams: BaseballTeam[] }) => {
  const [expanded, setExpanded] = useState(true);
  const [desktop, setDesktop] = useState(false);
  const showMap = desktop || expanded;

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1280px)");
    const syncDesktop = () => setDesktop(desktopQuery.matches);
    const openFromHash = () => {
      if (window.location.hash === "#map") setExpanded(true);
    };
    // A second tap on an existing #map URL must reopen a manually closed map.
    const openFromLink = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link) return;
      const url = new URL(link.href);
      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.hash === "#map"
      )
        setExpanded(true);
    };

    syncDesktop();
    openFromHash();
    desktopQuery.addEventListener("change", syncDesktop);
    window.addEventListener("hashchange", openFromHash);
    document.addEventListener("click", openFromLink);
    return () => {
      desktopQuery.removeEventListener("change", syncDesktop);
      window.removeEventListener("hashchange", openFromHash);
      document.removeEventListener("click", openFromLink);
    };
  }, []);

  return (
    <div
      id="map"
      className="scroll-mt-28 space-y-4 xl:sticky xl:top-28 xl:min-h-[520px]"
    >
      <Button
        variant="secondary"
        fullWidth
        className="min-h-11 sm:w-auto xl:hidden"
        leftIcon={<FiMap aria-hidden />}
        rightIcon={
          <FiChevronDown aria-hidden className={expanded ? "rotate-180" : ""} />
        }
        aria-controls="team-map-panel"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "Hide team map" : "Show team map"}
      </Button>
      <div id="team-map-panel" hidden={!showMap}>
        {showMap && <TeamMap teams={teams} />}
      </div>
    </div>
  );
};

export { TeamMapPanel };
