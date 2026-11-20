"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Heading, Kicker, Text } from "@ryanmeetup/ui";
import { FiArrowRight, FiSliders } from "react-icons/fi";
import { ADMIN_ROOT, adminRoutes } from "@/lib/admin/admin-routes";
import { PageHeader } from "@/components/global";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import type { IntegrationCheck } from "@/lib/server/integration-health";
import { AdminPageShell } from "./AdminPageShell";
import { DemoPreviewCard } from "./DemoPreviewCard";
import { IntegrationStatusList } from "./IntegrationStatusList";

type AdminRoute = (typeof adminRoutes)[number];

const sectionDescriptions: Record<
  Exclude<AdminRoute["href"], typeof ADMIN_ROOT>,
  string
> = {
  "/admin/statuses":
    "The shared task columns, their order, and which ones complete work.",
  "/admin/access":
    "Access groups, membership, and which projects each group can reach.",
  "/admin/usage": "Email quota consumption and recently delivered messages.",
  "/admin/settings":
    "The name, wordmark, banners, and link preview this instance goes by.",
};

/**
 * One card per admin tab, minus the overview itself, so a new tab shows up here
 * as soon as it is added to `adminRoutes` with a description.
 */
const sections = adminRoutes.flatMap((route) =>
  route.href === ADMIN_ROOT
    ? []
    : [{ ...route, description: sectionDescriptions[route.href] }],
);

export function AdminOverviewPageClient({
  initialData,
  demoMode,
  integrations,
}: {
  initialData: WorkspaceData;
  demoMode: boolean;
  integrations: IntegrationCheck[];
}) {
  const { data, setData } = useWorkspaceData(initialData, demoMode);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AdminPageShell
      data={data}
      demoMode={demoMode}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      setData={setData}
    >
      <PageHeader
        icon={FiSliders}
        title="Admin"
        description="Everything that shapes this workspace for the whole team."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="group">
            <Card
              variant="solid"
              className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg motion-reduce:transform-none"
            >
              <div className="flex items-center justify-between gap-3">
                <Heading size="h3" className="flex items-center gap-2 text-xl">
                  <section.icon
                    aria-hidden
                    className="shrink-0 text-black/40 dark:text-white/40"
                  />
                  {section.label}
                </Heading>
                <FiArrowRight
                  aria-hidden
                  className="shrink-0 text-black/35 transition group-hover:translate-x-1 motion-reduce:transform-none dark:text-white/35"
                />
              </div>
              <Text className="mt-2 text-sm">{section.description}</Text>
            </Card>
          </Link>
        ))}
      </div>

      {/* The only place integration health is reported. It is read-only status
          rather than something an owner edits, so it belongs here beside the
          other at-a-glance information and not on the settings form. */}
      <section className="space-y-4">
        <Kicker>Integrations</Kicker>
        <Text className="text-sm">
          Credentials live in the hosting environment and are never editable or
          displayed here. Only their presence and a masked fingerprint are
          shown.
        </Text>
        <IntegrationStatusList integrations={integrations} />
      </section>

      <DemoPreviewCard />
    </AdminPageShell>
  );
}
