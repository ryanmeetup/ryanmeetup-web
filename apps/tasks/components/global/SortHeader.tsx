import { Fragment } from "react";
import { FiArrowDown, FiArrowUp, FiCheck, FiChevronDown, FiX } from "react-icons/fi";
import { DropdownMenu, DropdownMenuButton, DropdownMenuItem, DropdownMenuItems, DropdownMenuSeparator } from "@ryanmeetup/ui";

export type TableSort<K extends string> = { key: K; descending: boolean } | null;
export type SortChoice<K extends string> = { key: K; descending: boolean; label: string };

/** A key's two directions, named in the column's own words. */
export function sortBoth<K extends string>(key: K, ascending: string, descending: string): SortChoice<K>[] {
  return [{ key, descending: false, label: ascending }, { key, descending: true, label: descending }];
}

/** `name` or `name-desc`, the readable form a sort takes in a URL; anything unknown is no sort. */
export function parseTableSort<K extends string>(value: string, keys: readonly K[]): TableSort<K> {
  const descending = value.endsWith("-desc");
  const key = descending ? value.slice(0, -"-desc".length) : value;
  return (keys as readonly string[]).includes(key) ? { key: key as K, descending } : null;
}
export function tableSortValue<K extends string>(sort: TableSort<K>) {
  return sort ? `${sort.key}${sort.descending ? "-desc" : ""}` : "";
}

/**
 * A header that opens its column's sort choices: each one picked outright,
 * or back to the list's own order. `aria-sort` and the arrow say which is on.
 * `groups` are separated in the menu.
 */
export function SortHeader<K extends string>({ label, groups: choices, sort, onSort, className = "" }: {
  label: string;
  groups: SortChoice<K>[][];
  sort: TableSort<K>;
  onSort: (sort: TableSort<K>) => void;
  className?: string;
}) {
  const groups = choices.map((group) => group.map((choice) => ({
    ...choice,
    icon: choice.descending ? FiArrowDown : FiArrowUp,
    current: sort?.key === choice.key && sort.descending === choice.descending,
  })));
  const active = groups.flat().some((choice) => choice.key === sort?.key);
  // At rest a chevron says the header opens a menu; once sorted, the arrow says which way.
  const Indicator = active ? sort?.descending ? FiArrowDown : FiArrowUp : FiChevronDown;
  return <th scope="col" className={className} aria-sort={active ? sort?.descending ? "descending" : "ascending" : "none"}>
    <DropdownMenu>
      <DropdownMenuButton unstyled aria-label={`Sort by ${label.toLowerCase()}`}
        className={`-mx-1.5 -my-1 inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 font-semibold uppercase tracking-caps-tight transition hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 data-open:bg-black/5 data-open:text-black dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/50 dark:data-open:bg-white/10 dark:data-open:text-white ${active ? "text-black dark:text-white" : ""}`}>
        {label}
        <Indicator aria-hidden className={`h-3 w-3 shrink-0 ${active ? "" : "opacity-70"}`} />
      </DropdownMenuButton>
      <DropdownMenuItems align="start">
        {groups.map((group, index) => <Fragment key={group[0].label}>
          {index > 0 && <DropdownMenuSeparator />}
          {group.map(({ key, descending, label: choiceLabel, icon: Icon, current }) =>
            <DropdownMenuItem key={choiceLabel} onClick={() => onSort({ key, descending })}>
              <Icon aria-hidden className="h-4 w-4 opacity-60" />
              <span className="flex-1">{choiceLabel}</span>
              {current && <><FiCheck aria-hidden className="h-4 w-4" /><span className="sr-only">(current)</span></>}
            </DropdownMenuItem>)}
        </Fragment>)}
        {active && <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onSort(null)}><FiX aria-hidden className="h-4 w-4 opacity-60" />Clear sort</DropdownMenuItem>
        </>}
      </DropdownMenuItems>
    </DropdownMenu>
  </th>;
}
