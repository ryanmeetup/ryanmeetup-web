import { Suspense, type ReactNode } from "react";
import {
  PersistentWorkspaceShell,
  WorkspaceShellSkeleton,
} from "@/components/global";
import { demoData } from "@/lib/workspace/demo-data";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
} from "@/lib/server/workspace-page-loader";
import { requireWorkspaceEntry } from "@/lib/server/workspace-entry";

const shellCollections = [
  "profiles",
  "statuses",
  "categories",
  "categoryOwners",
  "projects",
  "projectOwners",
  "tasks",
  "taskAssignees",
] as const;

/**
 * The layout itself waits only on the signed-out redirect, which has to settle
 * before anything reaches the browser. Everything the shell needs to *draw*
 * streams in behind a boundary, so a cold load paints the chrome and a spinner
 * rather than leaving the document empty — with only the root layout's footer
 * on it — until the workspace queries come back.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const demoMode = await isWorkspaceDemo();
  if (!demoMode) await requireWorkspaceEntry();

  return (
    <Suspense fallback={<WorkspaceShellSkeleton />}>
      <LoadedWorkspaceShell demoMode={demoMode}>
        {children}
      </LoadedWorkspaceShell>
    </Suspense>
  );
}

async function LoadedWorkspaceShell({
  children,
  demoMode,
}: {
  children: ReactNode;
  demoMode: boolean;
}) {
  const initialData = demoMode
    ? demoData
    : (await loadWorkspacePage(shellCollections, { allowGuest: true })).data;

  return (
    <PersistentWorkspaceShell initialData={initialData} demoMode={demoMode}>
      {children}
    </PersistentWorkspaceShell>
  );
}
