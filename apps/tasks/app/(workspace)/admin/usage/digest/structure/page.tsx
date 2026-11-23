import type { Metadata } from "next";
import { DigestSettingsPageClient } from "@/components/usage";
import { getDigestSettings } from "@/lib/server/digest-settings";
import { pageTitle } from "@/lib/server/instance-settings";
import { loadWorkspacePage } from "@/lib/server/workspace-page-loader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Digest Structure") } };
}

/** The mobile route for the digest structure editor; `/admin/usage` keeps the dialog for desktop. */
export default async function DigestStructurePage() {
  const { data } = await loadWorkspacePage(
    ["profiles", "statuses", "categories", "projects"],
    { owner: true },
  );
  return (
    <DigestSettingsPageClient
      initialData={data}
      settings={await getDigestSettings()}
      editor="structure"
    />
  );
}
