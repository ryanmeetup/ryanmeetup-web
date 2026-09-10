import type { Metadata } from "next";
import { NewTaskPageClient } from "@/components/tasks";
import { demoData } from "@/lib/workspace/demo-data";
import {
  EDITOR_COLLECTIONS,
  redirectAccessPreviewAway,
} from "@/lib/server/editor-page-loader";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
} from "@/lib/server/workspace-page-loader";
import { pageTitle } from "@/lib/server/instance-settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("New Task") } };
}

/**
 * The mobile create route. The board's dialog covers desktop; this exists so a
 * phone gets the whole viewport for the form. It loads only the reference
 * collections the form reads — no tasks, since a new one has no history.
 */
export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  redirectAccessPreviewAway(query, "/board");
  const requestedProject =
    typeof query.project === "string" ? query.project : undefined;

  if (await isWorkspaceDemo()) {
    return (
      <NewTaskPageClient
        initialData={demoData}
        demoMode
        initialValues={{
          project_id:
            demoData.projects.find(
              (project) =>
                project.id === requestedProject ||
                project.name === requestedProject,
            )?.id ?? null,
        }}
      />
    );
  }

  const { data } = await loadWorkspacePage([...EDITOR_COLLECTIONS]);
  return (
    <NewTaskPageClient
      initialData={data}
      demoMode={false}
      initialValues={{
        project_id:
          data.projects.find(
            (project) =>
              project.id === requestedProject ||
              project.name === requestedProject,
          )?.id ?? null,
      }}
    />
  );
}
