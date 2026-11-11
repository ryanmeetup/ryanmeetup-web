import type { Priority } from "@/lib/tasks/task-types";

const priorityStyles: Record<Priority, string> = {
  low: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  medium:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  high: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  urgent:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
};

export function TaskPriorityBadge({
  priority,
  className = "",
  size = "default",
}: {
  priority: Priority;
  className?: string;
  size?: "compact" | "default";
}) {
  const sizeClasses =
    size === "compact"
      ? "px-1.5 py-0.5 tracking-caps-tight sm:px-2 sm:tracking-caps-tight"
      : "px-2 py-1 tracking-widest";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border text-[9px] font-bold uppercase ${sizeClasses} ${priorityStyles[priority]} ${className}`}
    >
      {priority}
    </span>
  );
}
