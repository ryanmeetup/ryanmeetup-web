import "server-only";

import { getAdminClient } from "@/lib/server/admin-client";
import { getStoreCustomerAuthScope } from "@/lib/server/store-customer-auth/scope";
import type { ModerationInitialState } from "@/lib/store-reviews/moderation";
import { loadReviewModerationPage } from "./moderation";
import { StoreReviewDatabaseError } from "./errors";

/** Call only after the workspace page loader has required app ownership. */
export async function loadReviewModerationScreen(actor: string): Promise<ModerationInitialState> {
  const scope = getStoreCustomerAuthScope();
  if (!scope) return { status: "disabled" };
  const admin = getAdminClient();
  if (!admin) return { status: "error" };
  try {
    return { status: "ready", page: await loadReviewModerationPage(admin, actor, scope.shopId, { filter: "pending", productId: null, after: null }) };
  } catch (error) {
    console.error("Review moderation page failed", { code: error instanceof StoreReviewDatabaseError ? error.code : undefined });
    return { status: "error" };
  }
}
