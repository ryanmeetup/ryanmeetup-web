import { Card } from "@ryanmeetup/ui";
import type { ReactNode } from "react";
import { FiCalendar, FiFolder, FiGrid, FiTag } from "react-icons/fi";
import type {
  AccessGroupOverview as AccessGroupOverviewModel,
  ExplainedAccess,
} from "@/lib/access/access-overview";

function AccessList({
  items,
  total,
}: {
  items: ExplainedAccess[];
  total: number;
}) {
  if (items.length === 0)
    return (
      <p className="mt-4 text-sm text-black/55 dark:text-white/55">
        No access from this group.
      </p>
    );
  return (
    <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto overscroll-contain border-y border-black/10 py-3 pr-1 dark:border-white/10">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-black/10 bg-black/[0.025] px-3 py-2 dark:border-white/10 dark:bg-white/[0.025]"
        >
          <p className="text-sm font-semibold">{item.name}</p>
          <p className="mt-0.5 text-xs text-black/55 dark:text-white/55">
            {item.reason}
          </p>
        </li>
      ))}
      {items.length < total && (
        <li className="px-1 pt-1 text-xs text-black/50 dark:text-white/50">
          {total - items.length} not available through this group
        </li>
      )}
    </ul>
  );
}

function ResourceCard({
  icon,
  items,
  title,
  total,
}: {
  icon: ReactNode;
  items: ExplainedAccess[];
  title: string;
  total: number;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          {icon} {title}
        </h3>
        <span className="text-xs font-semibold text-black/55 dark:text-white/55">
          {items.length} of {total}
        </span>
      </div>
      <AccessList items={items} total={total} />
    </Card>
  );
}

export function AccessGroupOverview({
  overview,
}: {
  overview: AccessGroupOverviewModel;
}) {
  return (
    <section aria-labelledby="effective-access-heading" className="space-y-4">
      <div>
        <h2 id="effective-access-heading" className="text-xl font-semibold">
          Effective access
        </h2>
        <p className="mt-1 text-sm text-black/65 dark:text-white/65">
          What membership in this group currently opens, with the rule that
          grants it. This is an explanation of the database policy, not another
          place to configure access.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <ResourceCard
          icon={<FiFolder aria-hidden />}
          title="Projects"
          items={overview.projects}
          total={overview.projectCount}
        />
        <ResourceCard
          icon={<FiTag aria-hidden />}
          title="Categories"
          items={overview.categories}
          total={overview.categoryCount}
        />
        <ResourceCard
          icon={<FiGrid aria-hidden />}
          title="Pages"
          items={overview.pages}
          total={overview.pageCount}
        />
      </div>
      <Card className="flex items-start gap-3 p-4 text-sm">
        <FiCalendar aria-hidden className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Google Calendar feed</p>
          <p className="mt-1 text-black/65 dark:text-white/65">
            {overview.calendarReason ??
              "Not available. The group must be able to open Calendar and have the feed permission directly or through tier inheritance."}
          </p>
        </div>
      </Card>
    </section>
  );
}
