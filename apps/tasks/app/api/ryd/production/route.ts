import { NextResponse } from "next/server";
import { rydProductionSchema } from "@/lib/api-schema";
import { rydMutationFailure } from "@/lib/server/ryd-mutations";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import { moveRydProduction } from "@/lib/server/ryd-bulk";

/**
 * Apply one bounded group atomically, refusing stale stages. A retry with the
 * same operation returns its receipt and the current canonical order state.
 */
export async function POST(request: Request) {
  const parsed = await readJson(request, rydProductionSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  try {
    return NextResponse.json(
      await moveRydProduction(
        context.admin,
        context.user.id,
        parsed.data.operationId,
        parsed.data.moves,
      ),
    );
  } catch (error) {
    return rydMutationFailure(
      request,
      "ryd.production",
      error,
      "Those orders couldn't be moved. Try again.",
    );
  }
}
