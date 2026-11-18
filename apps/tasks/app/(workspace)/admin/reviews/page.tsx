import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminReviewsPageClient } from "@/components/admin/AdminReviewsPageClient";
import { pageTitle } from "@/lib/server/instance-settings";
import { loadReviewModerationScreen } from "@/lib/server/store-reviews/moderation-screen";
import { isWorkspaceDemo, loadWorkspacePage } from "@/lib/server/workspace-page-loader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Store reviews") } };
}

export default async function AdminReviewsPage() {
  if (await isWorkspaceDemo()) redirect("/");
  const { data, user } = await loadWorkspacePage(["profiles", "statuses", "categories", "projects"], { owner: true });
  const initial = await loadReviewModerationScreen(user.id);
  return <AdminReviewsPageClient initialData={data} initial={initial} />;
}
