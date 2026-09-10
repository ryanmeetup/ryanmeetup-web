import { Button, DisclosureCard } from "@ryanmeetup/ui";
import { FiClock } from "react-icons/fi";
import {
  ActivityActorAvatar,
  ActivityChangeList,
  ActivityStatusChange,
} from "@/components/activity";
import { CountBadge } from "@/components/global";
import { profileDisplayName } from "@/lib/presentation";
import {
  taskActivityChanges,
  type TaskChangeLookups,
} from "@/lib/activity/task-change-presentation";
import { TASK_MOVE_ACTION } from "@/lib/activity/activity-events";
import { taskStatusChange } from "@/lib/activity/task-activity";
import type { TaskActivity } from "@/lib/activity/activity-types";
import { formatTimestamp } from "@/lib/date-format";

export function TaskActivityPanel({
  activity,
  conversationHeight,
  hasMore,
  loading,
  lookups,
  onLoadMore,
  pageLayout,
}: {
  activity: TaskActivity[];
  conversationHeight?: number;
  hasMore: boolean;
  loading: boolean;
  lookups: TaskChangeLookups;
  onLoadMore: () => void;
  pageLayout: boolean;
}) {
  return (
    <DisclosureCard
      defaultOpen={pageLayout}
      className=""
      buttonClassName="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/25 dark:focus-visible:ring-white/30"
      panelClassName="space-y-3 pt-3"
      iconClassName="h-3.5 w-3.5"
      summary={
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
          Activity <CountBadge>{activity.length}</CountBadge>
        </span>
      }
    >
      {loading && (
        <p role="status" className="text-sm text-black/60 dark:text-white/60">
          Loading task history…
        </p>
      )}
      <div
        className={`${pageLayout ? "min-h-48" : "max-h-32"} space-y-3 overflow-y-auto overscroll-contain pr-2`}
        style={
          pageLayout && conversationHeight
            ? {
                maxHeight: Math.max(
                  192,
                  conversationHeight - (hasMore ? 170 : 112),
                ),
              }
            : undefined
        }
      >
        {activity.map((item) => {
          const profile = lookups.profiles.find(
            (entry) => entry.id === item.actor_id,
          );
          const name = profileDisplayName(profile, "System");
          const changes = taskActivityChanges(item, lookups);
          const statusChange =
            item.action === TASK_MOVE_ACTION
              ? taskStatusChange(item, lookups.statuses)
              : null;
          return (
            <div
              key={item.id}
              className="flex items-start gap-2 border-l-2 border-black/10 pl-3 text-sm dark:border-white/10"
            >
              {/* A 24px avatar in a 20px line box centers on the first line
                  instead of hanging below it. */}
              <span className="flex h-5 shrink-0 items-center">
                <ActivityActorAvatar profile={profile} />
              </span>
              <div className="min-w-0 flex-1">
                <p>
                  <strong>{name}</strong>{" "}
                  {item.action === TASK_MOVE_ACTION
                    ? "moved the task"
                    : item.action}
                </p>
                {statusChange && (
                  <div className="mt-1 text-xs text-black/60 dark:text-white/60">
                    <ActivityStatusChange
                      from={statusChange.from}
                      to={statusChange.to}
                    />
                  </div>
                )}
                <ActivityChangeList changes={changes} className="mt-1" />
                <p className="mt-1 flex items-center gap-2 text-xs text-black/45 dark:text-white/45">
                  <FiClock
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 text-black/30 dark:text-white/30"
                  />
                  <time dateTime={item.created_at}>
                    {formatTimestamp(item.created_at)}
                  </time>
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <Button
          type="button"
          variant="secondary"
          loading={loading}
          onClick={onLoadMore}
        >
          Load older activity
        </Button>
      )}
    </DisclosureCard>
  );
}
