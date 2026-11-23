"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorCallout } from "@ryanmeetup/ui";
import {
  editorPageContentClassName,
  WorkspacePageShell,
} from "@/components/global";
import type { GoogleCalendarEvent } from "@/lib/calendar/google-calendar-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { GoogleEventModal } from "./GoogleEventModal";

/** `/calendar/google/[id]` — an imported Google invite as its own page. */
export function GoogleEventPageClient({
  initialData,
  event,
  error,
}: {
  initialData: WorkspaceData;
  event: GoogleCalendarEvent | null;
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
      {event ? (
        <GoogleEventModal
          presentation="page"
          event={event}
          onClose={() => router.push("/calendar")}
        />
      ) : (
        <ErrorCallout>{error}</ErrorCallout>
      )}
    </WorkspacePageShell>
  );
}
