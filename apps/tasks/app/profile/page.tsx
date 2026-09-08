import { redirect } from "next/navigation";
import { ProfilePageClient } from "@/components/profile";
import { createClient } from "@/lib/supabase/server";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
} from "@/lib/server/workspace-page-loader";
import { WorkspaceLoadError } from "@/lib/server/workspace-loader";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import type { Metadata } from "next";
import { pageTitle } from "@/lib/server/instance-settings";
import { safeWorkspaceReturnPath } from "@/lib/workspace/entry-route";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Profile") } };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const demoMode = await isWorkspaceDemo();
  if (demoMode) redirect("/");
  const params = await searchParams;
  const entryReason = params.reason === "onboarding" ? "onboarding" : undefined;
  const returnTo = safeWorkspaceReturnPath(params.next);

  let data: WorkspaceData;
  let email: string;
  let workspaceLoadReference: string | undefined;

  try {
    const result = await loadWorkspacePage(
      ["profiles", "statuses", "categories", "categoryOwners", "projects"],
      { requireOnboarding: false },
    );
    data = result.data;
    email = result.user.email ?? "";
  } catch (error) {
    if (!(error instanceof WorkspaceLoadError)) throw error;
    workspaceLoadReference = error.correlationId;

    // Fallback: load only the user's own profile (always readable via RLS).
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) redirect("/login");
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id,full_name,avatar_url,onboarding_completed,task_details_open_by_default,assign_new_tasks_to_self,editor_surface,calendar_default_view,favorite_project_ids,app_role",
      )
      .eq("id", auth.user.id)
      .maybeSingle();
    // Bouncing to /login would loop: the visitor is signed in, so /login sends
    // them back to /, which sends them here again. Surface the error instead.
    if (profileError || !profile)
      throw new WorkspaceLoadError("current profile", profileError);

    data = {
      currentProfile: profile,
      canManageCategories: profile.app_role === "owner",
      profiles: [profile],
      statuses: [],
      categories: [],
      projects: [],
      projectOwners: [],
      categoryOwners: [],
      tasks: [],
      subtasks: [],
      comments: [],
      activity: [],
      attachments: [],
      labels: [],
      taskAssignees: [],
      taskLabels: [],
      taskCategories: [],
    };
    email = auth.user.email ?? "";
  }

  return (
    <ProfilePageClient
      initialData={data}
      email={email}
      onboardingRequired={!data.currentProfile.onboarding_completed}
      workspaceLoadReference={workspaceLoadReference}
      entryReason={entryReason}
      returnTo={returnTo}
    />
  );
}
