import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoreDatabase, getStoreShopId } from "./store-database";

export type ReviewSuggestionAction = "dismiss" | "restore";
export const isSuggestionLineId = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value);

/** Private buyer preferences, separate from review eligibility and content. */
export function createReviewSuggestionStorage(database: SupabaseClient, shopId: string) {
  const table = "store_review_suggestion_dismissals";
  return {
    async dismissedLines(subject: string, lineIds: string[]): Promise<string[]> {
      if (!lineIds.length) return [];
      const { data, error } = await database.from(table).select("line_id")
        .eq("shop_id", shopId).eq("customer_subject", subject).in("line_id", lineIds)
        .abortSignal(AbortSignal.timeout(10_000));
      if (error || !Array.isArray(data) || data.some((row) => !isSuggestionLineId(row.line_id))) throw new Error("Suggestion preferences unavailable");
      return data.map((row) => row.line_id as string);
    },
    async change(subject: string, lineId: string, action: ReviewSuggestionAction): Promise<void> {
      if (!isSuggestionLineId(lineId)) throw new Error("Invalid suggestion");
      const query = action === "dismiss"
        ? database.from(table).upsert({ shop_id: shopId, customer_subject: subject, line_id: lineId }, { onConflict: "shop_id,customer_subject,line_id", ignoreDuplicates: true })
        : database.from(table).delete().eq("shop_id", shopId).eq("customer_subject", subject).eq("line_id", lineId);
      const { error } = await query.abortSignal(AbortSignal.timeout(10_000));
      if (error) throw new Error("Suggestion preference could not be saved");
    },
  };
}

export type ReviewSuggestionStorage = ReturnType<typeof createReviewSuggestionStorage>;

export function getReviewSuggestionStorage(): ReviewSuggestionStorage | null {
  const database = getStoreDatabase();
  const shopId = getStoreShopId();
  return database && shopId ? createReviewSuggestionStorage(database, shopId) : null;
}
