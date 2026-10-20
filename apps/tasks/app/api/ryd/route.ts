import { NextResponse } from "next/server";
import { loadRydQueue, rydContext } from "@/lib/server/ryd";

/** The queue as the page shows it, re-read after every change. */
export async function GET() {
  const context = await rydContext();
  if ("response" in context) return context.response;
  return NextResponse.json(await loadRydQueue(context.admin), {
    headers: { "cache-control": "no-store" },
  });
}
