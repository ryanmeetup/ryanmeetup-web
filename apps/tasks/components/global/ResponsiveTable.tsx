import type { HTMLAttributes, ReactNode, TdHTMLAttributes } from "react";

export type ResponsiveTableColumn = {
  label: string;
  /** Width utility for the column, e.g. `w-36`; leave one column unset to take the rest. */
  width?: string;
  /** Keep the header for screen readers only, as for an actions column. */
  hideLabel?: boolean;
};

/*
 * Below 54rem of container width each row restacks into a single column;
 * above it the cells line up under real headers. 54rem is where a 1280px
 * viewport's workspace content lands, so laptops get the table.
 */
const wide = {
  table:
    "block w-full text-left text-sm @min-[54rem]:table @min-[54rem]:table-fixed",
  head: "sr-only bg-black/[0.025] text-[10px] uppercase tracking-caps-tight text-black/60 dark:bg-white/[0.025] dark:text-white/60 @min-[54rem]:not-sr-only @min-[54rem]:table-header-group",
  body: "block @min-[54rem]:table-row-group",
  row: "grid gap-3 border-t border-black/10 p-4 first:border-t-0 dark:border-white/10 @min-[54rem]:table-row @min-[54rem]:p-0 @min-[54rem]:first:border-t",
  cell: "min-w-0 @min-[54rem]:px-3 @min-[54rem]:py-3 @min-[54rem]:align-middle @min-[54rem]:first:pl-4 @min-[54rem]:last:pr-4",
};

/**
 * A bordered table for management screens. It needs an `@container` ancestor,
 * whose width decides between the stacked and the columned layout.
 */
export function ResponsiveTable({
  caption,
  columns,
  children,
  className = "",
}: {
  caption: string;
  columns: ResponsiveTableColumn[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-black/10 dark:border-white/10 ${className}`}
    >
      <table className={wide.table}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.label} className={column.width} />
          ))}
        </colgroup>
        {/* Stacked rows read top to bottom, so the header row is only for screen readers there. */}
        <thead className={wide.head}>
          <tr>
            {columns.map((column) => (
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
            ))}
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
