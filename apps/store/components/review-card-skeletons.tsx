import { Card, SkeletonBar } from "@ryanmeetup/ui";

/** Text lines per placeholder, so the masonry columns settle unevenly like real reviews. */
const lineCounts = [3, 2, 4, 2, 3, 2];
const lineWidths = ["w-full", "w-11/12", "w-4/5", "w-2/3"];

/**
 * Stands in for review cards while a filter reads every page, in the same
 * masonry and card shape as the results, so the list doesn't flash an empty
 * state and then jump into place.
 */
export function ReviewCardSkeletons({ label, columns, className = "" }: {
  label: string;
  /** The results list's column classes, e.g. "md:columns-2 xl:columns-3". */
  columns: string;
  className?: string;
}) {
  return <div role="status" className={className}>
    <span className="sr-only">{label}</span>
    <ul aria-hidden className={`gap-4 ${columns}`}>
      {lineCounts.map((lines, card) => <li key={card} className="mb-4 min-w-0 break-inside-avoid last:mb-0">
        <Card size="lg" variant="outline">
          <SkeletonBar round className="h-5 w-40" />
          <div className="mt-3 flex items-center justify-between gap-4">
            <SkeletonBar className="h-4 w-24" />
            <SkeletonBar className="h-3 w-20" />
          </div>
          <div className="mt-4 space-y-2">
            {Array.from({ length: lines }, (_, line) => <SkeletonBar key={line}
              className={`h-4 ${line === lines - 1 ? "w-1/2" : lineWidths[(card + line) % lineWidths.length]}`} />)}
          </div>
          <div className="mt-5 flex items-center gap-2 border-t border-black/10 pt-4 dark:border-white/10">
            <SkeletonBar round className="size-8 shrink-0" />
            <div className="space-y-1.5">
              <SkeletonBar className="h-3 w-14" />
              <SkeletonBar className="h-4 w-20" />
            </div>
          </div>
        </Card>
      </li>)}
    </ul>
  </div>;
}
