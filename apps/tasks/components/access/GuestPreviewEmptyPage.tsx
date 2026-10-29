"use client";

import { useState } from "react";
import { EmptyState } from "@ryanmeetup/ui";
import { FiEyeOff } from "react-icons/fi";
import { PageHeader, WorkspacePageShell } from "@/components/global";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

/**
 * What an access preview shows for a guest who can open no page. The guest
 * themselves lands on their own profile, which a preview cannot borrow, so
 * this stands in for it inside the guest's own, empty, workspace chrome.
 */
export function GuestPreviewEmptyPage({
  initialData,
}: {
  initialData: WorkspaceData;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <WorkspacePageShell
      data={data}
      demoMode={false}
      setData={setData}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      contentClassName="p-3 sm:p-6 lg:p-6 xl:p-8"
    >
      <PageHeader
        icon={FiEyeOff}
        title="No pages yet"
        description="This guest can't open any page. Members in it only reach their own profile until a page is shared with their tier or one of their teams."
      />
      <EmptyState className="mt-6" message="Nothing to show" />
    </WorkspacePageShell>
  );
}
