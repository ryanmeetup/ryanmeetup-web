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
    // The board's own vertical scroller: one per column, running flush from
    // the rule above it to the rule below. The gutter that holds the first
    // and last task off those rules is inside the scroller, on the content —
    // so it is room the tasks rest in and scroll away with, and a task on its
    // way past is clipped at the rule itself rather than short of it. The
    // side padding is split with the row below to leave a focus ring room
    // inside the clip. Scrolling chains out of it at either end rather than
    // being contained: the columns cover most of the page, and the page above
    // them still has a heading and filters to scroll past.
    <div className="min-h-0 flex-1 overflow-y-auto px-2 sm:px-3">
      <div
        className={`space-y-2 px-1 py-3 transition-opacity sm:space-y-3 sm:py-4 ${isPending ? "pointer-events-none opacity-55" : ""}`}
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
