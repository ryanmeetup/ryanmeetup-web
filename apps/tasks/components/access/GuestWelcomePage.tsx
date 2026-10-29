"use client";

import { useState } from "react";
import { Avatar, Button, Card } from "@ryanmeetup/ui";
import { FiCompass, FiKey, FiUser } from "react-icons/fi";
import {
  PageHeader,
  useInstance,
  WorkspacePageShell,
} from "@/components/global";
import type { AppOwnerContact } from "@/lib/access/access-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

function ownerNames(owners: AppOwnerContact[]) {
  const names = owners.map((owner) => owner.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

/**
 * Where a guest lands before anything is shared with them, and what an access
 * preview of that guest shows. It says what the workspace is and who can open
 * more of it, rather than leaving a new partner on an empty page.
 */
export function GuestWelcomePage({
  initialData,
  owners,
}: {
  initialData: WorkspaceData;
  owners: AppOwnerContact[];
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { name } = useInstance();
  const contact = ownerNames(owners);
  return (
    <WorkspacePageShell
      data={data}
      demoMode={false}
      setData={setData}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      contentClassName="p-3 sm:p-6 lg:p-6 xl:p-8"
    >
      <div className="max-w-3xl space-y-6">
        <PageHeader
          icon={FiCompass}
          kicker="Welcome"
          title={`Welcome to ${name}`}
          description={`${name} is where the team plans and tracks its work: tasks and projects, notes, contacts, and a shared calendar. Your account is all set — it just doesn't have any pages yet.`}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
              What happens next
            </h2>
            <p className="text-sm leading-6 text-black/70 dark:text-white/70">
              As pages are shared with you, they show up in the sidebar and
              you&apos;ll start there instead of here. Nothing to install,
              nothing to configure.
            </p>
          </Card>
          <Card className="space-y-3">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
              <FiKey aria-hidden /> Need access?
            </h2>
            <p className="text-sm leading-6 text-black/70 dark:text-white/70">
              {contact
                ? `Reach out to ${contact} with what you're working on, and they'll share the pages you need.`
                : "Reach out to whoever invited you with what you're working on, and they'll share the pages you need."}
            </p>
            {owners.length > 0 && (
              <ul className="space-y-2">
                {owners.map((owner) => (
                  <li key={owner.id} className="flex items-center gap-3">
                    <Avatar name={owner.name} src={owner.avatarUrl} size="sm" />
                    <span className="text-sm font-semibold">{owner.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Button.Link
          href="/profile"
          variant="secondary"
          size="sm"
          leftIcon={<FiUser aria-hidden />}
          className="w-full sm:w-auto"
        >
          View your profile
        </Button.Link>
      </div>
    </WorkspacePageShell>
  );
}
