import { notFound } from "next/navigation";
import { AccessGroupPageClient } from "@/components/access";
import { accessGroupSlug } from "@/lib/access/access-groups";
import { buildAccessGroupOverview } from "@/lib/access/access-overview";
import { enabledWorkspaceAreas } from "@/lib/access/workspace-areas";
import { requireQueryData } from "@/lib/server/workspace-loader";
import { loadWorkspacePage } from "@/lib/server/workspace-page-loader";
import type { Metadata } from "next";
import { getInstanceSettings, pageTitle } from "@/lib/server/instance-settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Access Group") } };
}

export default async function AccessGroupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const {
    supabase,
    user,
    data: initialData,
  } = await loadWorkspacePage(
    ["profiles", "projects", "statuses", "categories", "categoryOwners"],
    { owner: true },
  );

  const groupsResult = await supabase
    .from("access_groups")
    .select("*")
    .order("name");
  const groups = requireQueryData("access groups", groupsResult);
  const group = groups.find((item) => accessGroupSlug(item.name) === slug);
  if (!group) notFound();
  const [
    membersResult,
    projectGrantsResult,
    categoryGrantsResult,
    areaAccessResult,
    areaGrantsResult,
  ] = await Promise.all([
    supabase.from("access_group_members").select("*").eq("group_id", group.id),
    supabase.from("project_group_grants").select("project_id,group_id"),
    supabase.from("category_group_grants").select("category_id,group_id"),
    supabase.from("workspace_area_access").select("area,access_mode"),
    supabase.from("workspace_area_group_grants").select("area,group_id"),
  ]);
  const members = requireQueryData("access group members", membersResult);
  const overview = buildAccessGroupOverview({
    group,
    groups,
    areas: enabledWorkspaceAreas(await getInstanceSettings()),
    projects: initialData.projects,
    categories: initialData.categories,
    projectGrants: requireQueryData(
      "project access grants",
      projectGrantsResult,
    ).map((grant) => ({
      resourceId: grant.project_id,
      groupId: grant.group_id,
    })),
    categoryGrants: requireQueryData(
      "category access grants",
      categoryGrantsResult,
    ).map((grant) => ({
      resourceId: grant.category_id,
      groupId: grant.group_id,
    })),
    areaAccess: requireQueryData("page access", areaAccessResult).map(
      (area) => ({ area: area.area, accessMode: area.access_mode }),
    ),
    areaGrants: requireQueryData("page access grants", areaGrantsResult).map(
      (grant) => ({ area: grant.area, groupId: grant.group_id }),
    ),
  });
  return (
    <AccessGroupPageClient
      currentUserId={user.id}
      initialData={initialData}
      group={group}
      initialGroups={groups}
      initialMembers={members}
      initialOverview={overview}
    />
  );
}
