import type { HTMLAttributes, ReactNode } from "react";

export type FilterBarProps = HTMLAttributes<HTMLDivElement> & {
  search: ReactNode;
  actions?: ReactNode;
  /**
   * Width at which search and filters share one row. Use `xl` when the bar
   * sits beside a sidebar and wide filter labels would clip the placeholder.
   */
  inlineFrom?: "lg" | "xl";
};

const layouts = {
  lg: { row: "lg:flex-row lg:items-stretch", actions: "lg:w-auto lg:flex-row" },
  xl: { row: "xl:flex-row xl:items-stretch", actions: "xl:w-auto xl:flex-row" },
} as const;

/**
 * Search on the left, filter controls to its right, all one height.
 *
 * Rows stretch rather than bottom-align, so compact filter controls grow to
 * the search input's height. Pass a search whose label is visually hidden
 * (`SearchInput` hides it by default); a visible label would stretch the
 * filters with it. Filter controls carry their own inline labels.
 */
const FilterBar = ({
  search,
  actions,
  inlineFrom = "lg",
  className,
  ...props
}: FilterBarProps) => (
  <div
    {...props}
    className={`flex w-full flex-col gap-4 ${layouts[inlineFrom].row} ${className ?? ""}`}
  >
    <div className="min-w-0 flex-1">{search}</div>
    {actions && (
      <div className={`flex w-full flex-col ${layouts[inlineFrom].actions}`}>
        {actions}
      </div>
    )}
  </div>
);

export { FilterBar };
