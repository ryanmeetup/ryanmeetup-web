"use client";

import { mutate, parseMutationResponse } from "@/lib/mutation-client";
import type { ModerationCursor, ModerationDecision, ModerationFilter, ModerationPage } from "./moderation";

export async function fetchModerationPage(filter: ModerationFilter, after: ModerationCursor | null = null): Promise<ModerationPage> {
  const params = new URLSearchParams({ filter });
  if (after) {
    params.set("afterCreatedAt", after.createdAt);
    params.set("afterId", after.id);
  }
  return parseMutationResponse<ModerationPage>(await fetch(`/api/admin/reviews?${params}`, { cache: "no-store" }));
}

export async function saveModerationDecision(decision: ModerationDecision) {
  const result = await mutate<{ saved: boolean }>("/api/admin/reviews", { method: "POST", body: JSON.stringify(decision) });
  if (result.saved !== true) throw new Error("The decision could not be confirmed.");
}
