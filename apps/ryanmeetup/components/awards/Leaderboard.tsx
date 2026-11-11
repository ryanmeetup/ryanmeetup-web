"use client";

import { Fragment, useMemo, useState } from "react";

// Components
import { AnimatedCollapse, Text } from "@ryanmeetup/ui";
import {
  AttendanceLegend,
  AttendanceRoster,
  AttendanceStrip,
} from "@/components/awards";
import { RepeatRyan } from "@/lib/types";
import NextImage from "next/image";
import {
  FaChevronDown as FaChevron,
  FaSort,
  FaSortDown as FaSortDescending,
  FaSortUp as FaSortAscending,
} from "react-icons/fa";
import useReorderTransition from "@/hooks/useReorderTransition";

// Utilities
import { convertImageUrl } from "@ryanmeetup/utils";
import {
  buildLeaderboardRows,
  formatStreakRange,
  getTopStreakLength,
  sortLeaderboardRows,
} from "@/utils/streaks";
import type { LeaderboardSort } from "@/utils/streaks";

type LeaderboardProps = {
  ryans: RepeatRyan[];
  timeline: string[];
};

type SortHeaderProps = {
  column: LeaderboardSort["column"];
  label: string;
  width: string;
  sort: LeaderboardSort;
  onSort: (column: LeaderboardSort["column"]) => void;
};

type TableHeaderProps = Pick<SortHeaderProps, "sort" | "onSort">;

const badgeStyles =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border text-xl font-semibold md:h-14 md:w-14 md:text-3xl";

// The two count columns share one gutter. It used to drop to zero at the larger
// breakpoints, which ran one heading's sort caret into the next heading.
const countColumn = "px-3";

const rankStyles =
  "inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold md:h-9 md:w-9 md:text-base";

// Gold, silver, and bronze for the podium, muted for everyone else.
const getRankStyles = (rank: number) => {
  if (rank === 1)
    return "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:border-amber-300/40 dark:bg-amber-300/15 dark:text-amber-200";
  if (rank === 2)
    return "border-slate-400/50 bg-slate-400/15 text-slate-700 dark:border-slate-300/40 dark:bg-slate-300/15 dark:text-slate-200";
  if (rank === 3)
    return "border-amber-800/30 bg-amber-800/10 text-amber-900 dark:border-amber-600/40 dark:bg-amber-600/15 dark:text-amber-500";

  return "border-black/10 bg-white/70 text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60";
};

const SortHeader = (props: SortHeaderProps) => {
  const { column, label, width, sort, onSort } = props;

  const isActive = sort.column === column;
  const isDescending = sort.direction === "desc";
  const SortIcon = !isActive
    ? FaSort
    : isDescending
      ? FaSortDescending
      : FaSortAscending;

  return (
    <th
      scope="col"
      aria-sort={
        isActive ? (isDescending ? "descending" : "ascending") : "none"
      }
      className={`${countColumn} pb-3 text-center align-bottom ${width}`}
    >
      {/* The label wraps in this narrow column, so the caret has to sit inline
          with the text rather than beside a flex row that would overflow. */}
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`w-full text-center uppercase transition-colors hover:text-black dark:hover:text-white lg:whitespace-nowrap ${isActive ? "text-black dark:text-white" : ""}`}
      >
        {label}{" "}
        <SortIcon
          aria-hidden
          className={`inline h-3 w-3 align-text-bottom ${isActive ? "" : "opacity-40"}`}
        />
        <span className="sr-only">
          {isActive
            ? `, sorted ${isDescending ? "highest" : "lowest"} first`
            : ", click to sort"}
        </span>
      </button>
    </th>
  );
};

// The headings are the widest thing in the count columns, so one tracking at
// every width is what pays for the gutter between them.
const TableHeader = (props: TableHeaderProps) => (
  <thead className="uppercase tracking-caps-tight text-[10px] text-black/70 dark:text-white/70">
    <tr className="border-b border-black/10 dark:border-white/10">
      <th scope="col" className="w-10 pb-3 pl-3 md:w-16 md:pl-4">
        Rank
      </th>
      <th scope="col" className="w-12 pb-3 md:w-16" aria-label="Headshot" />
      {/* `whitespace-nowrap` keeps these from being squeezed to one word per
          line by the full-width column at the end of the row. */}
      <th scope="col" className="pb-3 md:whitespace-nowrap">
        Name
      </th>
      <th
        scope="col"
        className="hidden pb-3 md:table-cell md:whitespace-nowrap"
      >
        Based in
      </th>
      <SortHeader
        column="attended"
        label="Attended"
        width="w-16 md:w-28"
        {...props}
      />
      {/* Wide enough that "Longest Streak" stops wrapping at the larger
          breakpoints, gutter included. */}
      <SortHeader
        column="streak"
        label="Longest Streak"
        width="w-16 md:w-32 lg:w-44"
        {...props}
      />
      {/* `w-full` in an auto-layout table hands this column whatever the fixed
          columns leave over, which is what the strip stretches across. */}
      <th scope="col" className="hidden pb-3 pl-4 md:table-cell md:w-full">
        Events Attended
      </th>
    </tr>
  </thead>
);

const Leaderboard = (props: LeaderboardProps) => {
  const { ryans, timeline } = props;

  const [sort, setSort] = useState<LeaderboardSort>({
    column: "attended",
    direction: "desc",
  });

  const [expanded, setExpanded] = useState<string[]>([]);

  const rows = useMemo(
    () => buildLeaderboardRows(ryans, timeline),
    [ryans, timeline],
  );

  const topStreak = useMemo(() => getTopStreakLength(rows), [rows]);

  const sortedRows = useMemo(
    () => sortLeaderboardRows(rows, sort),
    [rows, sort],
  );

  const { capture, register } = useReorderTransition(sort);

  // A new column starts on its highest values, since that is the interesting
  // end of both counts. Clicking the active column flips it.
  const handleSort = (column: LeaderboardSort["column"]) => {
    // Measure the old order before React paints the new one, so every row can
    // slide to its new place instead of jumping there.
    capture();

    setSort((current) =>
      current.column === column
        ? {
            column,
            direction: current.direction === "desc" ? "asc" : "desc",
          }
        : { column, direction: "desc" },
    );
  };

  // More than one row can stay open, so a visitor can line two Ryans' records
  // up against each other.
  const toggleRoster = (id: string) =>
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );

  return (
    <div className="space-y-3">
      {/* The key sits above the table rather than under it: the squares mean
          nothing until you have read it, and below a board of two dozen rows
          it is read last if at all. The strip only appears alongside the
          table, so its key hides with it. */}
      <div className="hidden md:flex md:justify-end">
        <AttendanceLegend />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5 pt-4">
        <table className="w-full text-sm text-left">
          <TableHeader sort={sort} onSort={handleSort} />
          <tbody>
            {sortedRows.map(({ ryan, rank, streak, attendance }, index) => {
              const isExpanded = expanded.includes(ryan.id);
              // The flame marks the best run on the board, not each row's own
              // best — every row in the column is already somebody's longest.
              const holdsTopStreak =
                topStreak > 0 && streak.length === topStreak;
              const rosterId = `roster-${ryan.id}`;
              const stripeStyles =
                index % 2 === 0 ? "bg-black/[0.02] dark:bg-white/[0.03]" : "";

              return (
                <Fragment key={ryan.id}>
                  {/* The divider fades rather than disappearing outright, so
                  a line never snaps back over a roster that is still closing.
                  Keeping the border on both states also spares the row the
                  pixel of travel that adding and removing one costs. */}
                  <tr
                    ref={register(ryan.id)}
                    className={`border-b transition-colors duration-300 motion-reduce:transition-none ${stripeStyles} ${isExpanded ? "border-transparent" : "border-black/10 dark:border-white/10"}`}
                  >
                    <td className="py-3 pl-3 pr-1 md:pl-4 md:pr-2">
                      <span className={`${rankStyles} ${getRankStyles(rank)}`}>
                        {rank}
                      </span>
                    </td>
                    <td className="py-3 pr-2 md:px-3">
                      <div className="relative h-10 w-10 md:h-12 md:w-12">
                        <NextImage
                          className="rounded-full shadow-lg"
                          src={convertImageUrl(ryan.headshot) ?? "/trophy.png"}
                          fill
                          style={{ objectFit: "cover" }}
                          alt={ryan.fullName}
                        />
                      </div>
                    </td>
                    <td className="py-3 pr-3 md:whitespace-nowrap">
                      <Text className="text-xs font-semibold text-black dark:text-white md:text-sm lg:text-base">
                        {ryan.fullName}
                      </Text>
                      <Text className="text-[11px] text-black/60 dark:text-white/60 md:hidden">
                        {ryan.basedIn}
                      </Text>
                    </td>
                    <td className="hidden py-3 pr-6 md:table-cell md:whitespace-nowrap">
                      <Text className="text-xs text-black/70 dark:text-white/70 md:text-sm lg:text-base">
                        {ryan.basedIn}
                      </Text>
                    </td>
                    <td className={`${countColumn} py-3 text-center`}>
                      <span
                        className={`${badgeStyles} border-black/10 bg-white/80 text-black dark:border-white/15 dark:bg-white/10 dark:text-white`}
                      >
                        {ryan.eventsAttended.length}
                      </span>
                      <Text className="mt-1 text-[10px] text-black/50 dark:text-white/50">
                        of {attendance.length}
                      </Text>
                    </td>
                    <td className={`${countColumn} py-3 text-center`}>
                      <span
                        className={`${badgeStyles} ${holdsTopStreak ? "border-orange-500/60 bg-orange-500/20 text-orange-700 dark:border-orange-400/60 dark:bg-orange-400/20 dark:text-orange-200" : "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-300"}`}
                        title={formatStreakRange(streak)}
                      >
                        {streak.length}
                      </span>
                      {/* This aligns with the attended column's `of N`
                          caption and explains whether the number is the
                          board-wide record or this Ryan's personal best. */}
                      <Text
                        className={`mt-1 text-[10px] ${holdsTopStreak ? "font-semibold text-orange-700 dark:text-orange-300" : "text-black/50 dark:text-white/50"}`}
                      >
                        {holdsTopStreak ? (
                          <>
                            <span aria-hidden>🔥</span> Streak leader
                          </>
                        ) : (
                          "Personal best"
                        )}
                      </Text>
                    </td>
                    <td className="hidden py-3 pl-4 pr-3 md:table-cell md:w-full">
                      <div className="flex items-start gap-3">
                        <AttendanceStrip
                          attendance={attendance}
                          attendedCount={ryan.eventsAttended.length}
                          streakRange={formatStreakRange(streak)}
                        />
                        <button
                          type="button"
                          onClick={() => toggleRoster(ryan.id)}
                          aria-expanded={isExpanded}
                          aria-controls={rosterId}
                          className="mt-0.5 shrink-0 rounded-full border border-black/10 p-1.5 text-black/50 transition-colors hover:text-black dark:border-white/10 dark:text-white/50 dark:hover:text-white"
                        >
                          <FaChevron
                            aria-hidden
                            className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                          <span className="sr-only">
                            {isExpanded ? "Hide" : "Show"} every Ryan Meetup for{" "}
                            {ryan.fullName}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* The roster only has room to spell out event names across
                  the full table, so it gets its own row underneath. The row
                  stays mounted at zero height, since `AnimatedCollapse` has
                  to have both ends of the height to animate between, and the
                  closed row leaves nothing behind: the collapsed box clips
                  the roster and its divider away entirely. */}
                  <tr
                    ref={register(rosterId)}
                    className={`hidden transition-colors duration-300 motion-reduce:transition-none md:table-row ${stripeStyles}`}
                  >
                    <td className="p-0" colSpan={7}>
                      <AnimatedCollapse id={rosterId} open={isExpanded}>
                        {/* The divider rides on a child of the clipping box
                        rather than the box itself, which would keep painting
                        its own border as a hairline under a closed row. */}
                        <div className="border-b border-black/10 dark:border-white/10">
                          <AttendanceRoster attendance={attendance} />
                        </div>
                      </AnimatedCollapse>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export { Leaderboard };
