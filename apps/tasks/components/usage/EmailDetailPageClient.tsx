"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  editorPageContentClassName,
  WorkspacePageShell,
} from "@/components/global";
import type { ResendEmailDetail } from "@/lib/usage/resend-usage-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { EmailDetailModal } from "./EmailDetailModal";

/** `/admin/usage/emails/[id]` — the email detail dialog as a page. */
export function EmailDetailPageClient({
  initialData,
  id,
  detail,
  error,
}: {
  initialData: WorkspaceData;
  id: string;
  detail?: ResendEmailDetail;
  error?: string;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  return (
    <WorkspacePageShell
      data={data}
      demoMode={false}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      setData={setData}
      contentClassName={editorPageContentClassName}
    >
      <EmailDetailModal
        presentation="page"
        email={{ id, subject: detail?.subject ?? "Email" }}
        initialDetail={detail}
        initialError={error}
        // Only a cancelled send closes the page: the email is gone from the schedule.
        onClose={() => router.push("/admin/usage")}
      />
    </WorkspacePageShell>
  );
}
