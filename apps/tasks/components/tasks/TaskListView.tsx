import { Card, DropdownSelect, Pagination } from "@ryanmeetup/ui";
import { FiChevronDown } from "react-icons/fi";
import type { Category, Project } from "@/lib/resources/resource-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import type { Status, Task } from "@/lib/tasks/task-types";
import {
  resolveTaskListItems,
  TaskListCards,
  TaskListRows,
} from "./TaskListItems";

export type TaskListData = {
  assigneesByTask: Map<string, Set<string>>;
  categories: Map<string, Category>;
  categoriesByTask: Map<string, Set<string>>;
  profiles: Map<string, Profile>;
  projects: Map<string, Project>;
  statuses: Status[];
  tasks: Task[];
};

export type TaskListPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export type TaskListSorting = {
  value: string;
  onChange: (sort: string) => void;
  onToggle: () => void;
};

export function TaskListView({
  data,
  pagination,
  sorting,
  loading,
  archived = false,
  onOpenTask,
}: {
  data: TaskListData;
  pagination: TaskListPagination;
  sorting: TaskListSorting;
  loading: boolean;
  /** The archive reads as a record: grouped by month, dated by when it closed. */
  archived?: boolean;
  onOpenTask: (task: Task) => void;
}) {
  const { page, pageSize, totalCount, onPageChange, onPageSizeChange } =
    pagination;
  const {
    value: sort,
    onChange: onSortChange,
    onToggle: onToggleSort,
  } = sorting;
  const items = resolveTaskListItems(data);
  return (
    <Card
      size="none"
      className={`overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}
    >
      <div className="md:hidden" aria-busy={loading}>
        <div className="flex items-center justify-between gap-3 border-b border-black/10 bg-black/[0.025] px-4 py-3 dark:border-white/10 dark:bg-white/[0.025]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/50 dark:text-white/50">
            {archived ? "Archive" : "Tasks"}
          </p>
          <DropdownSelect
            label="Sort"
            value={sort}
            onChange={onSortChange}
            options={[
              ...(archived ? [{ label: "Closed", value: "closed" }] : []),
              { label: "Updated", value: "updated" },
              { label: "Due", value: "due" },
              { label: "Priority", value: "priority" },
            ]}
            className="uppercase tracking-[0.12em]"
          />
        </div>
        <div className="divide-y divide-black/5 dark:divide-white/5">
          <TaskListCards
            items={items}
            archived={archived}
            onOpenTask={onOpenTask}
          />
        </div>
      </div>
      <div className="hidden overflow-x-auto md:block" aria-busy={loading}>
        <table className="w-full min-w-[1400px] table-fixed text-left">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[9%]" />
            <col className="w-[19%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="border-b border-black/10 bg-black/[0.025] text-[10px] uppercase tracking-[0.16em] text-black/50 dark:border-white/10 dark:bg-white/[0.025] dark:text-white/50">
            <tr>
              <th className="px-4 py-3">Task</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Categories</th>
              <th className="px-3 py-3">Project</th>
              <th className="px-3 py-3">Assignee</th>
              <th className="px-3 py-3">Priority</th>
              <th className="px-3 py-3">
                <button
                  className="flex items-center gap-1 whitespace-nowrap"
                  onClick={onToggleSort}
                >
                  {archived ? "Closed" : "Due"} <FiChevronDown />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            <TaskListRows
              items={items}
              archived={archived}
              onOpenTask={onOpenTask}
            />
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        itemLabel="tasks"
        disabled={loading}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </Card>
  );
}
