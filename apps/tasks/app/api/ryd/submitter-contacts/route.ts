import { NextResponse } from "next/server";
import { rydEmailsSchema } from "@/lib/api-schema/ryd";
import { apiError, databaseFailure } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import { isMissingRelation } from "@/lib/server/supabase-errors";

/**
 * Record that the reviewer emailed these unmatched submitters from their own
 * mail app. Each call is one more attempt per address.
 */
export async function POST(request: Request) {
  const parsed = await readJson(request, rydEmailsSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;

  const contactedAt = new Date().toISOString();
  const result = await context.admin.from("ryd_submitter_contacts").insert(
    parsed.data.emails.map((email) => ({
      email,
      contacted_by: context.user.id,
      contacted_at: contactedAt,
    })),
  );
  if (result.error) {
    if (isMissingRelation(result.error.code))
      return apiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Marking people contacted needs a pending database update. Apply it, then try again.",
      );
    return databaseFailure(request, "ryd.contacts", result.error, {
      error: "Those contacts couldn't be recorded. Try again.",
    });
  }
  return NextResponse.json({
    contactedAt,
    markedCount: parsed.data.emails.length,
  });
}
