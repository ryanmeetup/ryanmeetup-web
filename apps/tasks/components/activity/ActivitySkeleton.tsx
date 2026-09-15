import { SkeletonBar } from "@/components/global/SkeletonBar";

const skeletonRows = Array.from({ length: 10 }, (_, index) => index);

/** Keep the feed's pending height independent of the selected page size. */
export function ActivityCardSkeletons() {
  return skeletonRows.map((index) => (
    <div
      key={index}
      aria-hidden="true"
      data-activity-skeleton=""
      className="h-30 space-y-3 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SkeletonBar round className="h-6 w-6 shrink-0" />
          <SkeletonBar className="h-4 w-28" />
        </div>
        <SkeletonBar className="h-3 w-24 shrink-0" />
      </div>
      <SkeletonBar className="h-4 w-3/4" />
      <SkeletonBar className="h-4 w-1/2" />
    </div>
  ));
}

export function ActivityRowSkeletons({ showProject }: { showProject: boolean }) {
  return skeletonRows.map((index) => (
    <tr
      key={index}
      aria-hidden="true"
      data-activity-skeleton=""
      className="h-14"
    >
      <td className="px-4">
        <SkeletonBar className="h-4 w-4/5" />
      </td>
      <td className="px-4">
        <div className="flex items-center gap-2">
          <SkeletonBar round className="h-6 w-6 shrink-0" />
          <SkeletonBar className="h-4 w-2/3" />
        </div>
      </td>
      <td className="px-4">
        <SkeletonBar className="h-4 w-3/4" />
      </td>
      <td className="px-4">
        <SkeletonBar className="h-4 w-4/5" />
      </td>
      {showProject && (
        <td className="px-4">
          <SkeletonBar className="h-4 w-2/3" />
        </td>
      )}
    </tr>
  ));
}
