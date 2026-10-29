"use client";

import { useState } from "react";
import { CategoriesModal } from "./CategoriesModal";
import { categoryController } from "./category-workspace";
import { WorkspacePageShell } from "@/components/global";
import { ProjectsModal } from "@/components/projects";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

export function CategoriesPageClient({
  initialData,
  demoMode,
}: {
  initialData: WorkspaceData;
  demoMode: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);

  return (
    <>
      <WorkspacePageShell
        data={data}
        demoMode={demoMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onCreateCategory={() => setCreateOpen(true)}
        onCreateProject={() => setProjectCreateOpen(true)}
        setData={setData}
        contentClassName="p-3 sm:p-6 lg:p-6 xl:p-8"
      >
        <CategoriesModal
          controller={categoryController(data, setData, demoMode)}
          options={{
            embedded: true,
            readOnly: !data.canManageCategories,
          }}
          events={{ onCreate: () => setCreateOpen(true) }}
        />
      </WorkspacePageShell>
      {createOpen && !data.accessPreview && data.canManageCategories && (
        <CategoriesModal
          modal={{ open: createOpen, setOpen: setCreateOpen }}
          controller={categoryController(data, setData, demoMode)}
          options={{ createOnly: true }}
        />
      )}
      {projectCreateOpen && (
        <ProjectsModal
          modal={{ open: projectCreateOpen, setOpen: setProjectCreateOpen }}
          workspace={{ data, setData, demoMode }}
          options={{ createOnly: true }}
        />
      )}
    </>
  );
}
