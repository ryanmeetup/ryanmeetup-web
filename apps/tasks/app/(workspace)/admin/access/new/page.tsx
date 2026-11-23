import type { Metadata } from "next";
import { AccessGroupCreatePageClient } from "@/components/access";
import { pageTitle } from "@/lib/server/instance-settings";
import { loadWorkspacePage } from "@/lib/server/workspace-page-loader";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { kind } = await searchParams;
  return {
    title: { absolute: await pageTitle(kind === "tier" ? "New Tier" : "New Team") },
  };
}

/**
 * The mobile create route for tiers and teams; `/admin/access` keeps the
 * dialog for desktop. It shadows a group page at `/admin/access/new`, which is
 * why `isReservedAccessGroupName` keeps any group from taking that slug.
 */
export default async function NewAccessGroupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kind } = await searchParams;
  const { data } = await loadWorkspacePage(
    ["profiles", "projects", "statuses", "categories", "categoryOwners"],
    { owner: true },
  );
  return (
    <AccessGroupCreatePageClient
      initialData={data}
      kind={kind === "tier" ? "tier" : "team"}
    />
  );
}
