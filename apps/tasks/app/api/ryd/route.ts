import { NextResponse } from "next/server";
import { loadRydQueue, rydContext } from "@/lib/server/ryd";

/** The queue as the page shows it, re-read after every change. */
export async function GET(request?: Request) {
  const context = await rydContext();
  if ("response" in context) return context.response;
  return NextResponse.json(
    await loadRydQueue(context.admin, {
      olderDone:
        request != null &&
        new URL(request.url).searchParams.get("done") === "all",
      signal: request?.signal,
      fresh: request?.headers.get("cache-control")?.includes("no-cache"),
    }),
    { headers: { "cache-control": "no-store" } },
  );
}
