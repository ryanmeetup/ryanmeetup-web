import { SkeletonBar } from "@/components/global/SkeletonBar";

const skeletonRows = Array.from({ length: 10 }, (_, index) => index);

/** Keep the list's pending height independent of the selected page size. */
export function TaskListCardSkeletons() {
  return skeletonRows.map((index) => (
    <div
      key={index}
      aria-hidden="true"
      data-task-list-skeleton=""
      className="h-24 p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <SkeletonBar className="h-4 w-3/5" />
        <SkeletonBar round className="h-5 w-14" />
      </div>
      <div className="mt-4 flex gap-3">
        <SkeletonBar className="h-3 w-16" />
        <SkeletonBar className="h-3 w-28" />
        <SkeletonBar className="h-3 w-20" />
      </div>
    </div>
  ));
}

export function TaskListRowSkeletons() {
  const widths = [
    "w-4/5",
    "w-2/3",
    "w-3/5",
    "w-4/5",
    "w-3/4",
    "w-2/3",
    "w-3/4",
  ];
  return skeletonRows.map((index) => (
    <tr
      key={index}
      aria-hidden="true"
      data-task-list-skeleton=""
      className="h-14"
    >
      {widths.map((width, column) => (
        <td key={column} className={column === 0 ? "px-4" : "px-3"}>
          <SkeletonBar className={`h-4 ${width}`} />
        </td>
      ))}
    </tr>
  ));
}
