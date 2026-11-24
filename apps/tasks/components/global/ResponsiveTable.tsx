import type { HTMLAttributes, ReactNode, TdHTMLAttributes } from "react";
import { DropdownMenuButton } from "@ryanmeetup/ui";
import { FiMoreHorizontal } from "react-icons/fi";
import { SortHeader } from "./SortHeader";
import type { SortChoice, TableSort } from "./SortHeader";

export type ResponsiveTableColumn = {
  label: string;
  /** Width utility for the column, e.g. `w-36`; leave one column unset to take the rest. */
  width?: string;
  /** Keep the header for screen readers only, as for an actions column. */
  hideLabel?: boolean;
  /** Makes the header a sort menu. Stacked rows hide headers, so offer the same choices elsewhere there. */
  sort?: {
    groups: SortChoice<string>[][];
    current: TableSort<string>;
    onSort: (sort: TableSort<string>) => void;
  };
};

/*
 * Below 54rem of container width each row restacks into a single column;
 * above it the cells line up under real headers. 54rem is where a 1280px
 * viewport's workspace content lands, so laptops get the table.
 */
const wide = {
  table: "block w-full text-left text-sm @min-[54rem]:table",
  // Fixed honours each column's width; auto lets columns size to their content.
  fixed: "@min-[54rem]:table-fixed",
  head: "sr-only bg-black/[0.025] text-[10px] uppercase tracking-caps-tight text-black/60 dark:bg-white/[0.025] dark:text-white/60 @min-[54rem]:not-sr-only @min-[54rem]:table-header-group",
  body: "block @min-[54rem]:table-row-group",
  row: "grid gap-3 border-t border-black/10 p-4 first:border-t-0 dark:border-white/10 @min-[54rem]:table-row @min-[54rem]:p-0 @min-[54rem]:first:border-t",
  cell: "min-w-0 @min-[54rem]:px-3 @min-[54rem]:py-3 @min-[54rem]:align-middle @min-[54rem]:first:pl-4 @min-[54rem]:last:pr-4",
};

/**
 * A bordered table for management screens. It needs an `@container` ancestor,
 * whose width decides between the stacked and the columned layout. With
 * `layout="auto"` columns fit their content; give long-text cells a max width.
 */
export function ResponsiveTable({
  caption,
  columns,
  children,
  layout = "fixed",
  className = "",
}: {
  caption: string;
  columns: ResponsiveTableColumn[];
  children: ReactNode;
  layout?: "fixed" | "auto";
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-black/10 dark:border-white/10 ${className}`}
    >
      <table
        className={`${wide.table} ${layout === "fixed" ? wide.fixed : ""}`}
      >
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.label} className={column.width} />
          ))}
        </colgroup>
        {/* Stacked rows read top to bottom, so the header row is only for screen readers there. */}
        <thead className={wide.head}>
          <tr>
            {columns.map((column) =>
              column.sort ? (
                <SortHeader
                  key={column.label}
                  label={column.label}
                  groups={column.sort.groups}
                  sort={column.sort.current}
                  onSort={column.sort.onSort}
                  className="px-3 py-3 first:pl-4 last:pr-4"
                />
              ) : (
                <th
                  key={column.label}
                  scope="col"
                  className="px-3 py-3 font-semibold first:pl-4 last:pr-4"
                >
                  {column.hideLabel ? (
                    <span className="sr-only">{column.label}</span>
                  ) : (
                    column.label
                  )}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className={wide.body}>{children}</tbody>
      </table>
    </div>
  );
}

export function ResponsiveTableRow({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={`${wide.row} ${className}`} />;
}

export function ResponsiveTableCell({
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={`${wide.cell} ${className}`} />;
}

/**
 * The "More actions" trigger at the end of a row; wrap it in `DropdownMenu`
 * beside the row's `DropdownMenuItems`. `label` should name the row's item.
 */
export function ResponsiveTableMenuButton({
  label,
  disabled,
}: {
  label: string;
  disabled?: boolean;
}) {
  return (
    <DropdownMenuButton
      unstyled
      disabled={disabled}
      aria-label={label}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-black/10 text-black transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:opacity-50 data-open:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10 dark:focus-visible:ring-white/30 dark:data-open:bg-white/10"
    >
      <FiMoreHorizontal aria-hidden />
    </DropdownMenuButton>
  );
}
