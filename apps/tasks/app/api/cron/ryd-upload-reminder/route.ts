import { NextResponse } from "next/server";
import { runRydUploadReminder } from "@/lib/server/ryd-upload-reminder";

export const runtime = "nodejs";

/**
 * The RY-D upload reminder worker. Vercel invokes this every hour; the slot
 * in RY-D Settings decides which hour sends, so the day and time are owned by
 * the app rather than by `vercel.mjs`.
 */
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  return NextResponse.json(await runRydUploadReminder());
}
