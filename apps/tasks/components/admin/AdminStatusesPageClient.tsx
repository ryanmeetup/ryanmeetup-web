"use client";

import { useState } from "react";
import { FiColumns, FiPlus } from "react-icons/fi";
import { Button } from "@ryanmeetup/ui";
import { PageHeader } from "@/components/global";
import { StatusCreateModal, StatusSettings } from "@/components/tasks";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import type { Status } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { AdminPageShell } from "./AdminPageShell";
import { taskCompletionLifecycle } from "@/lib/tasks/status-outcome";

export function AdminStatusesPageClient({
  initialData,
  demoMode,
}: {
  initialData: WorkspaceData;
  demoMode: boolean;
}) {
  const { data, setData } = useWorkspaceData(initialData, demoMode);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const updateStatuses = (update: (current: Status[]) => Status[]) =>
    setData((current) => ({
      ...current,
      statuses: update(current.statuses),
    }));

  return (
    <AdminPageShell
      data={data}
      demoMode={demoMode}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      setData={setData}
    >
      <PageHeader
        icon={FiColumns}
        title="Statuses"
        description="The shared task columns, their order, which ones complete work, and which ones require a reason."
        actions={
          <Button
            size="sm"
            leftIcon={<FiPlus />}
            /* Rides up beside the title instead of the header's bottom edge. */
            className="w-full sm:w-auto sm:self-start"
            onClick={() => setCreateOpen(true)}
          >
            New status
          </Button>
        }
      />
      <StatusSettings
        statuses={data.statuses}
        demoMode={demoMode}
        onStatusesChange={updateStatuses}
        onStatusOutcomeChange={(id, outcome) => {
          setData((current) => ({
            ...current,
            statuses: current.statuses.map((status) =>
              status.id === id ? { ...status, outcome } : status,
            ),
            // What the database does for us on the next read: a status that
            // starts or stops closing work re-dates every task sitting in it.
            tasks: current.tasks.map((task) =>
              task.status_id === id
                ? { ...task, ...taskCompletionLifecycle({ outcome }, task) }
                : task,
            ),
          }));
        }}
      />
      <StatusCreateModal
        open={createOpen}
        setOpen={setCreateOpen}
        statuses={data.statuses}
        onStatusesChange={updateStatuses}
        demoMode={demoMode}
      />
    </AdminPageShell>
  );
}
