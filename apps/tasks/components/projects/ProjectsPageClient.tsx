"use client";

import { useState } from "react";
import { ProjectsModal } from "./ProjectsModal";
import { CategoriesModal } from "@/components/categories";
import { categoryController } from "@/components/categories/category-workspace";
import { WorkspacePageShell } from "@/components/global";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

export function ProjectsPageClient({
  initialData,
  demoMode,
}: {
  initialData: WorkspaceData;
  demoMode: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);

  return (
    <>
      <WorkspacePageShell
        data={data}
        demoMode={demoMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onCreateCategory={() => setCategoryCreateOpen(true)}
        onCreateProject={() => setCreateOpen(true)}
        setData={setData}
        contentClassName="p-3 sm:p-6 lg:p-6 xl:p-8"
      >
        <ProjectsModal
          workspace={{ data, setData, demoMode }}
          options={{
            embedded: true,
            showOwnerNames: true,
          }}
          events={{ onCreate: () => setCreateOpen(true) }}
        />
      </WorkspacePageShell>

      {createOpen && !data.accessPreview && (
        <ProjectsModal
          modal={{ open: createOpen, setOpen: setCreateOpen }}
          workspace={{ data, setData, demoMode }}
          options={{ createOnly: true }}
        />
      )}
      {categoryCreateOpen && !data.accessPreview && (
        <CategoriesModal
          modal={{ open: categoryCreateOpen, setOpen: setCategoryCreateOpen }}
          controller={categoryController(data, setData, demoMode)}
          options={{ createOnly: true }}
        />
      )}
    </>
  );
}
