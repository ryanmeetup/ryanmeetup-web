"use client";

import type { ReactNode } from "react";
import type { Task } from "@/lib/tasks/task-types";

export function BoardColumnTasks({
  statusName,
  tasks,
  query,
  isPending,
  renderTask,
  onCreate,
}: {
  statusName: string;
  /** Already narrowed to the column's search. */
  tasks: Task[];
  query: string;
  /** The column carries `aria-busy`; this only dims the stale results. */
  isPending: boolean;
  renderTask: (task: Task) => ReactNode;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-2 p-1 sm:space-y-3">
      <div
        className={`space-y-2 transition-opacity sm:space-y-3 ${isPending ? "pointer-events-none opacity-55" : ""}`}
      >
        {tasks.map(renderTask)}
        {tasks.length === 0 && query.trim() && (
          <div className="rounded-xl border border-dashed border-black/15 px-3 py-6 text-center text-xs text-black/50 sm:py-8 dark:border-white/15 dark:text-white/50">
            No {statusName} tasks match this search.
          </div>
        )}
        {tasks.length === 0 && !query.trim() && (
          <button
            onClick={onCreate}
            className="w-full rounded-xl border border-dashed border-black/15 px-3 py-6 text-xs text-black/40 hover:border-black/30 hover:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 sm:py-8 dark:border-white/15 dark:text-white/40 dark:hover:border-white/30 dark:hover:text-white/60 dark:focus-visible:ring-white/30"
          >
            Drop a task here or add one
          </button>
        )}
      </div>
    </div>
  );
}
