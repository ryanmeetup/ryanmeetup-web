"use client";

import { useState } from "react";
import { FiMessageSquare } from "react-icons/fi";
import { PageHeader } from "@/components/global";
import { ReviewModerationQueue } from "@/components/store-reviews/ReviewModerationQueue";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import type { ModerationInitialState } from "@/lib/store-reviews/moderation";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { AdminPageShell } from "./AdminPageShell";

export function AdminReviewsPageClient({ initialData, initial }: { initialData: WorkspaceData; initial: ModerationInitialState }) {
  const { data, setData } = useWorkspaceData(initialData, false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const staffNames = Object.fromEntries(data.profiles.map((profile) => [profile.id, profile.full_name]));
  return <AdminPageShell data={data} demoMode={false} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} setData={setData}>
    <PageHeader icon={FiMessageSquare} title="Store reviews" description="Review buyer submissions, manage publication, and keep a private decision history." />
    <ReviewModerationQueue initial={initial} staffNames={staffNames} />
  </AdminPageShell>;
}
