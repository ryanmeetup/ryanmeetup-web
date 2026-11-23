"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editorPageContentClassName, WorkspacePageShell } from "@/components/global";
import { useAccessManagement } from "@/hooks/useAccessManagement";
import { accessGroupSlug } from "@/lib/access/access-groups";
import { adminAccessGroupPath, adminAccessPath } from "@/lib/admin/admin-routes";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { CreateAccessGroupModal, type AccessGroupKind } from "./CreateAccessGroupModal";

/**
 * `/admin/access/new?kind=tier|team` — the create dialog as a page. A new
 * group lands on its own page, where members and grants are added next.
 */
export function AccessGroupCreatePageClient({
  initialData,
  kind,
}: {
  initialData: WorkspaceData;
  kind: AccessGroupKind;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const access = useAccessManagement({ initialGroups: [], initialMembers: [] });

  return (
    <WorkspacePageShell
      data={data}
      demoMode={false}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      setData={setData}
      contentClassName={editorPageContentClassName}
    >
      <CreateAccessGroupModal
        presentation="page"
        kind={kind}
        onCreate={access.createGroup}
        onCreated={(group) => {
          router.push(adminAccessGroupPath(accessGroupSlug(group.name)));
          router.refresh();
        }}
        setOpen={(open) => {
          if (!open) router.push(adminAccessPath);
        }}
      />
    </WorkspacePageShell>
  );
}
