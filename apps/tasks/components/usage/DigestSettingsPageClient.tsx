"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editorPageContentClassName, WorkspacePageShell } from "@/components/global";
import type { DigestSettings } from "@/lib/digest/digest-settings";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { DigestCadenceModal } from "./DigestCadenceModal";
import { DigestStructureModal } from "./DigestStructureModal";

/**
 * `/admin/usage/digest/cadence` and `/admin/usage/digest/structure` — the
 * usage page's two digest dialogs as pages. Saving or cancelling returns to
 * the usage page, which renders the stored settings fresh.
 */
export function DigestSettingsPageClient({
  initialData,
  settings,
  editor,
}: {
  initialData: WorkspaceData;
  settings: DigestSettings;
  editor: "cadence" | "structure";
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const Editor = editor === "cadence" ? DigestCadenceModal : DigestStructureModal;

  return (
    <WorkspacePageShell
      data={data}
      demoMode={false}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      setData={setData}
      contentClassName={editorPageContentClassName}
    >
      <Editor
        presentation="page"
        open
        setOpen={(open) => {
          if (!open) router.push("/admin/usage");
        }}
        settings={settings}
        demoMode={false}
        onSaved={() => undefined}
      />
    </WorkspacePageShell>
  );
}
