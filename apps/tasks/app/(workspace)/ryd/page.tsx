import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RydPageClient } from "@/components/ryd";
import { getAdminClient } from "@/lib/server/admin-client";
import { getInstanceSettings, pageTitle } from "@/lib/server/instance-settings";
import { loadRydQueue } from "@/lib/server/ryd";
import { isRydGoogleConfigured } from "@/lib/server/ryd-google";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
} from "@/lib/server/workspace-page-loader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("RY-D Verification") } };
}

export default async function RydPage() {
  // Customer data has no demo stand-in, and an instance that doesn't sell
  // RY-Ds has no such page.
  if ((await isWorkspaceDemo()) || !(await getInstanceSettings()).rydEnabled)
    notFound();
  const loaded = await loadWorkspacePage(
    ["profiles", "statuses", "categories", "projects"],
    { area: "ryd" },
  );
  const admin = getAdminClient();
  if (!admin) notFound();

  return (
    <RydPageClient
      initialData={loaded.data}
      initialQueue={await loadRydQueue(admin)}
      googleConfigured={isRydGoogleConfigured()}
    />
  );
}
