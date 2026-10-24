"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, IconButton, toast } from "@ryanmeetup/ui";
import {
  FiCalendar,
  FiFolder,
  FiGrid,
  FiMinus,
  FiPlus,
  FiTag,
} from "react-icons/fi";
import type {
  AccessGroupOverview as AccessGroupOverviewModel,
  ExplainedAccess,
} from "@/lib/access/access-overview";
import {
  toggleResourceGroupAccess,
  type AccessResourceKind,
} from "@/lib/access/access-mutations";
import { errorMessage } from "@/lib/presentation";

type ChangeAccess = (item: ExplainedAccess) => void;

function AccessItem({
  item,
  available,
  busy,
  groupName,
  onChange,
}: {
  item: ExplainedAccess;
  available: boolean;
  busy: boolean;
  groupName: string;
  onChange: ChangeAccess;
}) {
  const grant = item.change?.action === "grant";
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${available ? "border-black/10 bg-black/[0.025] dark:border-white/10 dark:bg-white/[0.025]" : "border-dashed border-black/15 dark:border-white/15"}`}
    >
      <div className="min-w-0">
        <p
          className={`truncate text-sm font-semibold ${available ? "" : "text-black/70 dark:text-white/70"}`}
        >
          {item.name}
        </p>
        <p className="mt-0.5 text-xs text-black/55 dark:text-white/55">
          {item.reason}
        </p>
      </div>
      {item.change && (
        <IconButton
          size="sm"
          variant={grant ? "subtle" : "danger"}
          label={
            grant
              ? `Give ${groupName} access to ${item.name}`
              : `Remove ${groupName}'s access to ${item.name}`
          }
          disabled={busy}
          onClick={() => onChange(item)}
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          {grant ? <FiPlus aria-hidden /> : <FiMinus aria-hidden />}
        </IconButton>
      )}
    </li>
  );
}

function AccessList({
  items,
  unavailable,
  busy,
  groupName,
  onChange,
}: {
  items: ExplainedAccess[];
  unavailable: ExplainedAccess[];
  busy: boolean;
  groupName: string;
  onChange: ChangeAccess;
}) {
  const row = { busy, groupName, onChange };
  if (items.length === 0 && unavailable.length === 0)
    return (
      <p className="mt-4 text-sm text-black/55 dark:text-white/55">
        Nothing to show yet.
      </p>
    );
  return (
    <div
      aria-busy={busy}
      className="mt-4 max-h-64 space-y-2 overflow-y-auto overscroll-contain border-y border-black/10 py-3 pr-1 dark:border-white/10"
    >
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <AccessItem key={item.id} item={item} available {...row} />
          ))}
        </ul>
      ) : (
        <p className="px-1 text-sm text-black/55 dark:text-white/55">
          No access from this group.
        </p>
      )}
      {unavailable.length > 0 && (
        <>
          <p className="px-1 pt-2 text-xs font-semibold uppercase tracking-wider text-black/55 dark:text-white/55">
            Not available · {unavailable.length}
          </p>
          <ul className="space-y-2">
            {unavailable.map((item) => (
              <AccessItem
                key={item.id}
                item={item}
                available={false}
                {...row}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ResourceCard({
  icon,
  items,
  title,
  total,
  unavailable,
  ...row
}: {
  icon: ReactNode;
  items: ExplainedAccess[];
  title: string;
  total: number;
  unavailable: ExplainedAccess[];
  busy: boolean;
  groupName: string;
  onChange: ChangeAccess;
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
      <AccessList items={items} unavailable={unavailable} {...row} />
    </Card>
  );
}

export function AccessGroupOverview({
  groupId,
  groupName,
  overview,
}: {
  groupId: string;
  groupName: string;
  overview: AccessGroupOverviewModel;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  // Each write replaces a resource's whole grant set, so the buttons stay
  // disabled until the refreshed overview carries the set just written.
  const busy = saving || refreshing;

  function changeAccess(kind: AccessResourceKind) {
    return async (item: ExplainedAccess) => {
      if (!item.change) return;
      const grant = item.change.action === "grant";
      setSaving(true);
      try {
        await toggleResourceGroupAccess(kind, item.id, groupId, item.change);
        toast.success(
          grant
            ? `${groupName} can now open ${item.name}.`
            : `${groupName} no longer has direct access to ${item.name}.`,
        );
        startRefresh(() => router.refresh());
      } catch (error) {
        toast.error(
          errorMessage(error, `${item.name} access could not be changed.`),
        );
      } finally {
        setSaving(false);
      }
    };
  }

  const row = { busy, groupName };
  return (
    <section aria-labelledby="effective-access-heading" className="space-y-4">
      <div>
        <h2 id="effective-access-heading" className="text-xl font-semibold">
          Effective access
        </h2>
        <p className="mt-1 text-sm text-black/65 dark:text-white/65">
          What membership in this group currently opens, with the rule behind
          each. Add anything it cannot open, or remove what is selected for it
          directly. Open and inherited access change where that rule lives.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <ResourceCard
          icon={<FiFolder aria-hidden />}
          title="Projects"
          onChange={changeAccess("project")}
          {...row}
          items={overview.projects}
          total={overview.projectCount}
          unavailable={overview.unavailableProjects}
        />
        <ResourceCard
          icon={<FiTag aria-hidden />}
          title="Categories"
          onChange={changeAccess("category")}
          {...row}
          items={overview.categories}
          total={overview.categoryCount}
          unavailable={overview.unavailableCategories}
        />
        <ResourceCard
          icon={<FiGrid aria-hidden />}
          title="Pages"
          onChange={changeAccess("page")}
          {...row}
          items={overview.pages}
          total={overview.pageCount}
          unavailable={overview.unavailablePages}
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
