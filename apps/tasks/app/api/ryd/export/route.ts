import { databaseFailure } from "@/lib/server/api-response";
import {
  buildRydExport,
  rydContext,
  rydExportFilename,
} from "@/lib/server/ryd";

/**
 * Download the file fulfillment would be sent, without sending it or marking
 * anything cleared. For a reviewer who wants to check it, or send it by hand.
 */
export async function GET(request: Request) {
  const context = await rydContext();
  if ("response" in context) return context.response;
  try {
    const { csv } = await buildRydExport(context.admin);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${rydExportFilename()}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return databaseFailure(
      request,
      "ryd.export",
      error as { code?: string; message?: string },
      { error: "The file could not be built. Try again." },
    );
  }
}
