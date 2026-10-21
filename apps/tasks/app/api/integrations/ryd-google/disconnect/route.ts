import { NextResponse } from "next/server";
import { emptyObjectSchema } from "@/lib/api-schema/ryd";
import { apiError } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import {
  loadRydGoogleIntegration,
  revokeRydGoogle,
  RYD_GOOGLE_INTEGRATION_ID,
} from "@/lib/server/ryd-google";

export async function POST(request: Request) {
  const parsed = await readJson(request, emptyObjectSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  try {
    const connection = await loadRydGoogleIntegration();
    if (connection) await revokeRydGoogle(connection);
    const result = await context.admin
      .from("ryd_google_integrations")
      .delete()
      .eq("id", RYD_GOOGLE_INTEGRATION_ID);
    if (result.error) throw result.error;
  } catch (error) {
    console.error("RY-D Google connection could not be removed", error);
    return apiError(
      500,
      "OPERATION_FAILED",
      "Google could not be disconnected.",
    );
  }
  return NextResponse.json({ disconnected: true });
}
