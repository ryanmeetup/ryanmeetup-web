"use client";

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react";
import { Fragment, useId } from "react";
import { FiCheck, FiChevronDown, FiSearch } from "react-icons/fi";
import { Avatar, type AvatarProps } from "./Avatar";
import {
  fieldSelectButtonClasses,
  getFieldLabelClasses,
} from "./fieldStyles";
import { useDropdownSearch } from "./useDropdownSearch";

export type MultiSelectOption = {
  avatar?: AvatarProps;
  group?: {
    color?: string;
    label: string;
  };
  label: string;
  value: string;
};

export type MultiSelectProps = {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  summaryLimit?: number;
};

const MultiSelect = ({
  label,
  options,
  value,
  onChange,
  className,
  disabled = false,
  placeholder = "Select options",
  required = false,
  searchable = true,
  searchPlaceholder = "Search options",
  summaryLimit = 2,
}: MultiSelectProps) => {
  const buttonId = useId();
  const searchId = useId();
  const { handleInputKeyDown, handleOptionsKeyDown, inputRef, query, setQuery } =
    useDropdownSearch();
  const selectedOptions = options.filter((option) =>
    value.includes(option.value),
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleOptions = normalizedQuery
    ? options.filter((option) =>
        [option.label, option.group?.label].some((text) =>
          text?.toLocaleLowerCase().includes(normalizedQuery),
        ),
      )
    : options;
  const selectedLabels = selectedOptions.map((option) => option.label);
  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= summaryLimit
        ? selectedLabels.join(", ")
        : `${selectedLabels.slice(0, summaryLimit).join(", ")} +${selectedLabels.length - summaryLimit}`;

  return (
    <Listbox
      as="div"
      multiple
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`flex min-w-0 flex-col gap-2 ${className ?? ""}`}
    >
      <label className={getFieldLabelClasses()} htmlFor={buttonId}>
        <span>{label}</span>
        {required && <span className="shrink-0 text-red-500">*</span>}
      </label>
      <ListboxButton
        id={buttonId}
        aria-required={required || undefined}
        onClick={() => setQuery("")}
        className={fieldSelectButtonClasses}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          {selectedOptions.some((option) => option.avatar) && (
            <span className="flex shrink-0 -space-x-1" aria-hidden>
              {selectedOptions
                .filter((option) => option.avatar)
                .slice(0, 3)
                .map((option) => (
                  <Avatar
                    key={option.value}
                    {...option.avatar}
                    size="sm"
                    className={`-my-1 ring-1 ring-white dark:ring-[#303030] ${option.avatar?.className ?? ""}`}
                  />
                ))}
            </span>
          )}
          <span
            className={`truncate ${selectedLabels.length === 0 ? "font-normal text-black/50 dark:text-white/50" : ""}`}
          >
            {summary}
          </span>
        </span>
        <FiChevronDown
          aria-hidden
          className="shrink-0 text-black/40 dark:text-white/40"
        />
      </ListboxButton>
      <Transition
        enter="transition duration-150 ease-out"
        enterFrom="translate-y-1 scale-95 opacity-0"
        enterTo="translate-y-0 scale-100 opacity-100"
        leave="transition duration-100 ease-in"
        leaveFrom="translate-y-0 scale-100 opacity-100"
        leaveTo="translate-y-1 scale-95 opacity-0"
      >
        <ListboxOptions
          anchor="bottom start"
          onKeyDown={searchable ? handleOptionsKeyDown : undefined}
          className="z-[60] mt-2 flex max-h-80 w-[var(--button-width)] origin-top flex-col gap-1 overflow-y-auto rounded-xl border border-black/10 bg-white/95 p-1.5 text-black shadow-xl backdrop-blur focus:outline-none dark:border-white/10 dark:bg-[#181818]/95 dark:text-white"
        >
          {searchable && (
            <div className="sticky top-0 z-10 bg-white/95 p-1 backdrop-blur dark:bg-[#181818]/95">
              <label className="sr-only" htmlFor={searchId}>
                {searchPlaceholder}
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-black/15 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-black/20 dark:border-white/15 dark:bg-white/10 dark:focus-within:ring-white/20">
                <FiSearch
                  aria-hidden
                  className="shrink-0 text-black/40 dark:text-white/40"
                />
                <input
                  id={searchId}
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/45 dark:placeholder:text-white/45"
                />
              </div>
            </div>
          )}
          {visibleOptions.map((option, index) => {
            const showGroup =
              option.group &&
              option.group.label !== visibleOptions[index - 1]?.group?.label;

            return (
              <Fragment key={option.value}>
                {showGroup && (
                  <div className="mb-1 flex items-center gap-2 border-b border-black/10 px-3 pb-2 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-black/55 first:pt-1 dark:border-white/10 dark:text-white/55">
                    {option.group?.color && (
                      <i
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: option.group.color }}
                      />
                    )}
                    <span className="truncate">{option.group?.label}</span>
                  </div>
                )}
                <ListboxOption
                  value={option.value}
                  className="group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition focus:outline-none data-focus:bg-black/5 data-selected:bg-black/5 data-selected:font-semibold dark:data-focus:bg-white/10 dark:data-selected:bg-white/10"
                >
                  {option.avatar && (
                    <Avatar
                      {...option.avatar}
                      size="md"
                      className={`-my-1 ${option.avatar.className ?? ""}`}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <FiCheck
                    aria-hidden
                    className="shrink-0 opacity-0 group-data-selected:opacity-100"
                  />
                </ListboxOption>
              </Fragment>
            );
          })}
          {visibleOptions.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-black/60 dark:text-white/60">
              No matching options
            </p>
          )}
        </ListboxOptions>
      </Transition>
    </Listbox>
  );
};

export { MultiSelect };
