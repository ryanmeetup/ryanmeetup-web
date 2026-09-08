import { FiCalendar } from "react-icons/fi";
import { FormSection } from "@/components/resources";
import { formatCalendarDate } from "@/lib/date-format";

/**
 * A project's own dates. New projects begin today by default, but the author
 * can move or clear that value when the work began on a different day.
 *
 * An existing project that never recorded a start date keeps the field blank
 * rather than filling it in: blank is how the workspace stores "no date of its
 * own", and every surface that reads one falls back to the day the project was
 * added here. `inheritedStartDate` is that fallback, named under the field so
 * an empty box reads as inheritance rather than as missing data.
 */
export function ProjectTimelineFields({
  startDate,
  dueDate,
  inheritedStartDate,
  onStartDateChange,
  onDueDateChange,
  disabled,
}: {
  startDate: string;
  dueDate: string;
  inheritedStartDate?: string;
  onStartDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  disabled: boolean;
}) {
  const outOfOrder = Boolean(startDate && dueDate && dueDate < startDate);
  const inheriting = startDate ? undefined : inheritedStartDate;

  return (
    <FormSection
      title="Timeline"
      description={
        inheritedStartDate
          ? "A blank start date keeps the day this project was added here. Set one if the work began on another day."
          : "Starts today by default. Change it if the work began on another day."
      }
      icon={<FiCalendar className="h-4 w-4" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="date-field">
            <span>Start date</span>
            <input
              type="date"
              value={startDate}
              max={dueDate || undefined}
              disabled={disabled}
              onChange={(event) => onStartDateChange(event.target.value)}
            />
          </label>
          {inheriting && (
            <p className="text-xs leading-relaxed text-black/55 dark:text-white/55">
              Using {formatCalendarDate(inheriting)}, the day it was added here.
            </p>
          )}
        </div>
        <label className="date-field">
          <span>Due date</span>
          <input
            type="date"
            value={dueDate}
            min={startDate || undefined}
            disabled={disabled}
            onChange={(event) => onDueDateChange(event.target.value)}
          />
        </label>
      </div>
      {outOfOrder && (
        <p className="text-xs font-medium text-red-700 dark:text-red-300">
          The due date cannot fall before the start date.
        </p>
      )}
    </FormSection>
  );
}
