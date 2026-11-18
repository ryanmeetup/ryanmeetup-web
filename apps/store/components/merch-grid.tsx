import type { ReactNode } from "react";

// Full literal strings so Tailwind can see every column class.
// Two up on phones, widening as the shelf does.
const shelf = "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
const phone = { 1: "grid-cols-1", 2: "grid-cols-2" } as const;
const desktop = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" } as const;
const wide = { 1: "xl:grid-cols-1", 2: "xl:grid-cols-2", 3: "xl:grid-cols-3", 4: "xl:grid-cols-4" } as const;

/**
 * The fewest columns that still fit `count` cards in the minimum number of rows `max` allows,
 * so rows come out as even as possible: 6 → 3+3 rather than 4+2, 5 → 3+2, 4 or 8 → full rows of 4.
 */
export function balancedColumns(count: number, max: number) {
  if (count <= 1) return 1;
  const rows = Math.ceil(count / max);
  return Math.ceil(count / rows);
}

function evenColumns(count: number) {
  return [
    phone[balancedColumns(count, 2) as keyof typeof phone],
    desktop[balancedColumns(count, 3) as keyof typeof desktop],
    wide[balancedColumns(count, 4) as keyof typeof wide],
  ].join(" ");
}

/**
 * The store's one merch layout. Every grid of `MediaCard`s — product listings on the home
 * page and collection pages, and the home page's collection tiles — renders through this so
 * columns and gaps stay identical everywhere. The product page keeps its own single column.
 * `evenRows` picks columns from the item count so no row is left noticeably short.
 */
export function MerchGrid({ items, evenRows = false, className = "", label }: {
  items: { key: string; card: ReactNode }[];
  evenRows?: boolean;
  /** Spacing only; the columns belong to the grid. */
  className?: string;
  label?: string;
}) {
  return (
    <ul aria-label={label} className={`grid gap-3 sm:gap-5 ${evenRows ? evenColumns(items.length) : shelf} ${className}`}>
      {items.map(({ key, card }) => <li key={key} className="min-w-0">{card}</li>)}
    </ul>
  );
}
