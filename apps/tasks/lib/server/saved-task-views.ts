import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SavedTaskView,
  SavedTaskViewsState,
} from "@/lib/tasks/saved-task-views";
import { isMissingRelation } from "./supabase-errors";
import { requireQueryData } from "./workspace-loader";

export const SAVED_TASK_VIEW_COLUMNS = "id,name,settings";

export async function loadSavedTaskViews(
  database: SupabaseClient,
  userId: string,
): Promise<SavedTaskViewsState> {
  const result = await database
    .from("saved_task_views")
    .select(SAVED_TASK_VIEW_COLUMNS)
    .eq("profile_id", userId)
    .order("name");
  if (result.error && isMissingRelation(result.error.code))
    return { views: [], available: false };
  return {
    views: requireQueryData("saved task views", result) as SavedTaskView[],
    available: true,
  };
}

export function createSavedTaskView(
  database: SupabaseClient,
  userId: string,
  values: Pick<SavedTaskView, "name" | "settings">,
) {
  return database
    .from("saved_task_views")
    .insert({ ...values, profile_id: userId })
    .select(SAVED_TASK_VIEW_COLUMNS)
    .single();
}

export function updateSavedTaskView(
  database: SupabaseClient,
  userId: string,
  id: string,
  values: Partial<Pick<SavedTaskView, "name" | "settings">>,
) {
  return database
    .from("saved_task_views")
    .update(values)
    .eq("profile_id", userId)
    .eq("id", id)
    .select(SAVED_TASK_VIEW_COLUMNS)
    .maybeSingle();
}

export function deleteSavedTaskView(
  database: SupabaseClient,
  userId: string,
  id: string,
) {
  return database
    .from("saved_task_views")
    .delete()
    .eq("profile_id", userId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
}
