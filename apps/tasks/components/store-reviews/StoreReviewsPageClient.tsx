"use client";

import { useState } from "react";
import { WorkspacePageShell } from "@/components/global";
import { ReviewModerationQueue } from "@/components/store-reviews/ReviewModerationQueue";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import type { ModerationInitialState, ModerationView } from "@/lib/store-reviews/moderation";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

export function StoreReviewsPageClient({ initialData, initial, initialView }: { initialData: WorkspaceData; initial: ModerationInitialState; initialView: ModerationView }) {
  const { data, setData } = useWorkspaceData(initialData, false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const staffNames = Object.fromEntries(data.profiles.map((profile) => [profile.id, profile.full_name]));
  return <WorkspacePageShell data={data} demoMode={false} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} setData={setData}
    contentClassName="p-3 sm:p-6 lg:p-6 xl:p-8">
    <div className="mx-auto max-w-7xl">
      <ReviewModerationQueue initial={initial} initialView={initialView} staffNames={staffNames} />
    </div>
  </WorkspacePageShell>;
}
