"use client";

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react";
import { Fragment, useId, type ReactNode } from "react";
import { FiCheck, FiChevronDown, FiSearch } from "react-icons/fi";
import { Avatar, type AvatarProps } from "./Avatar";
import {
  fieldSelectButtonClasses,
  getFieldLabelClasses,
} from "./fieldStyles";
import { getFilterControlClasses } from "./filterStyles";
import { useDropdownSearch } from "./useDropdownSearch";
import { useProximityOptions } from "./useProximityOptions";

export type DropdownSelectOption = {
  avatar?: AvatarProps;
  group?: {
    icon?: ReactNode;
    label: string;
  };
  label: string;
  value: string;
  color?: string;
};

export type DropdownSelectProps = {
  label: string;
  options: DropdownSelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  variant?: "compact" | "field";
  active?: boolean;
  proximityValue?: string;
  proximityGroup?: string;
  searchPlaceholder?: string;
  stackLabelOnMobile?: boolean;
};

const DropdownSelect = ({
  label,
  options,
  value,
  onChange,
  className,
  required = false,
  disabled = false,
  variant = "compact",
  active = false,
  proximityValue,
  proximityGroup,
  searchPlaceholder = `Search ${label.toLocaleLowerCase()}`,
  stackLabelOnMobile = false,
}: DropdownSelectProps) => {
  const buttonId = useId();
  const searchId = useId();
  const { handleInputKeyDown, handleOptionsKeyDown, inputRef, query, setQuery } =
    useDropdownSearch();
  const selected = options.find((option) => option.value === value);
  const field = variant === "field";
  const { opensUpward, orderedOptions, setAnchorElement } = useProximityOptions(
    options,
    proximityValue,
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleOptions = normalizedQuery
    ? orderedOptions.filter((option) =>
        [option.label, option.group?.label].some((text) =>
          text?.toLocaleLowerCase().includes(normalizedQuery),
        ),
      )
    : orderedOptions;
  const proximityOption = normalizedQuery
    ? undefined
    : visibleOptions.find((option) => option.value === proximityValue);
  const proximityGroupOptions =
    normalizedQuery || !proximityGroup
      ? []
      : visibleOptions.filter(
          (option) => option.group?.label === proximityGroup,
        );
  const proximityOptions = proximityOption
    ? [proximityOption]
    : proximityGroupOptions;
  const proximityValues = new Set(
    proximityOptions.map((option) => option.value),
  );
  const remainingOptions = visibleOptions.filter(
    (option) => !proximityValues.has(option.value),
  );
  const displayedOptions = normalizedQuery
    ? visibleOptions
    : opensUpward
      ? [...remainingOptions, ...proximityOptions]
      : [...proximityOptions, ...remainingOptions];
  const renderOption = (option: DropdownSelectOption) => (
    <ListboxOption
      key={option.value}
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
      {option.color && (
        <i
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: option.color }}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      <FiCheck
        aria-hidden
        className="shrink-0 opacity-0 group-data-selected:opacity-100"
      />
    </ListboxOption>
  );
  const renderOptions = (items: DropdownSelectOption[]) =>
    items.map((option, index) => {
      const showGroup =
        option.group && option.group.label !== items[index - 1]?.group?.label;

      return (
        <Fragment key={option.value}>
          {showGroup && (
            <div className="flex items-center gap-2 border-b border-black/10 px-3 pb-2 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-black/55 dark:border-white/10 dark:text-white/55">
              {option.group?.icon}
              <span className="truncate">{option.group?.label}</span>
            </div>
          )}
          {renderOption(option)}
        </Fragment>
      );
    });
  return (
    <Listbox
      as="div"
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={field ? "flex min-w-0 flex-col gap-2" : "contents"}
    >
      {field && (
        <label className={getFieldLabelClasses()} htmlFor={buttonId}>
          <span>{label}</span>
          {required && <span className="shrink-0 text-red-500">*</span>}
        </label>
      )}
      <ListboxButton
        id={buttonId}
        aria-required={required || undefined}
        onClick={() => setQuery("")}
        className={`${field ? fieldSelectButtonClasses : `${getFilterControlClasses(active)} shrink-0 ${stackLabelOnMobile ? "!grid grid-cols-[7rem_minmax(0,1fr)_auto] justify-stretch gap-3 px-3 py-2.5 text-left lg:!inline-flex lg:w-auto lg:justify-center lg:gap-2 lg:px-3 lg:py-1.5" : ""} disabled:cursor-not-allowed disabled:opacity-40`} ${className ?? ""}`}
      >
        {!field && (
          <span
            className={`${stackLabelOnMobile ? "text-[10px] font-semibold uppercase tracking-wider text-black/55 dark:text-white/55 lg:text-xs lg:normal-case lg:tracking-normal" : "text-black/50 dark:text-white/50"}`}
          >
            {label}
          </span>
        )}
        <span className="inline-flex min-w-0 items-center gap-2">
          {selected?.avatar && (
            <Avatar
              {...selected.avatar}
              size="sm"
              className={`-my-1 ${selected.avatar.className ?? ""}`}
            />
          )}
          {selected?.color && (
            <i
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: selected.color }}
            />
          )}
          <span className="truncate">{selected?.label ?? value}</span>
        </span>
        <FiChevronDown
          aria-hidden
          className="ml-auto shrink-0 text-black/40 dark:text-white/40"
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
          ref={setAnchorElement}
          anchor={{ to: "bottom start", padding: 16 }}
          onKeyDown={handleOptionsKeyDown}
          className={`z-50 mt-2 flex max-h-80 max-w-[calc(100vw-2rem)] origin-top flex-col rounded-xl border border-black/10 bg-white/95 p-1.5 text-black shadow-xl backdrop-blur focus:outline-none dark:border-white/10 dark:bg-[#181818]/95 dark:text-white ${field || stackLabelOnMobile ? "w-[var(--button-width)]" : "w-56"} ${!field && stackLabelOnMobile ? "lg:w-56" : ""}`}
        >
          <div className="shrink-0 bg-white/95 p-1 backdrop-blur dark:bg-[#181818]/95">
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
          <div className="min-h-0 space-y-1 overflow-y-auto">
            {renderOptions(displayedOptions)}
          </div>
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

export { DropdownSelect };
