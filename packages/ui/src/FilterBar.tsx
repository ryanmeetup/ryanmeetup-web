import type { HTMLAttributes, ReactNode } from "react";

export type FilterBarProps = HTMLAttributes<HTMLDivElement> & {
  search: ReactNode;
  actions?: ReactNode;
};

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
  className,
  ...props
}: FilterBarProps) => (
  <div
    {...props}
    className={`flex w-full flex-col gap-4 lg:flex-row lg:items-stretch ${className ?? ""}`}
  >
    <div className="min-w-0 flex-1">{search}</div>
    {actions && (
      <div className="flex w-full flex-col lg:w-auto lg:flex-row">
        {actions}
      </div>
    )}
  </div>
);

export { FilterBar };
