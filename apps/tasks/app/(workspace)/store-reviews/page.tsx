import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StoreReviewsPageClient } from "@/components/store-reviews/StoreReviewsPageClient";
import { pageTitle } from "@/lib/server/instance-settings";
import { loadReviewModerationScreen } from "@/lib/server/store-reviews/moderation-screen";
import { getStoreCustomerAuthScope } from "@/lib/server/store-customer-auth/scope";
import { isWorkspaceDemo, loadWorkspacePage } from "@/lib/server/workspace-page-loader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Store reviews") } };
}

export default async function StoreReviewsPage() {
  if (await isWorkspaceDemo()) redirect("/");
  const { data, user } = await loadWorkspacePage(["profiles", "statuses", "categories", "projects"], { owner: true });
  // An instance without the store backend (PRD) has no such page, the same way
  // the sidebar never offers it there.
  if (!getStoreCustomerAuthScope()) notFound();
  const initial = await loadReviewModerationScreen(user.id);
  return <StoreReviewsPageClient initialData={data} initial={initial} />;
}
