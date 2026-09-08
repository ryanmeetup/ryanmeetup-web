import { FiCalendar } from "react-icons/fi";
import { FormSection } from "@/components/resources";

/**
 * A project's own dates. New projects begin today by default, but the author
 * can move or clear that value when the work began on a different day.
 */
export function ProjectTimelineFields({
  startDate,
  dueDate,
  onStartDateChange,
  onDueDateChange,
  disabled,
}: {
  startDate: string;
  dueDate: string;
  onStartDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  disabled: boolean;
}) {
  const outOfOrder = Boolean(startDate && dueDate && dueDate < startDate);

  return (
    <FormSection
      title="Timeline"
      description="Starts today by default. Change it if the work began on another day."
      icon={<FiCalendar className="h-4 w-4" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
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
