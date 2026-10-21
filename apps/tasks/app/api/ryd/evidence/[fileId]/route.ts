import { apiError, notFound } from "@/lib/server/api-response";
import { loadRydSettings, rydContext } from "@/lib/server/ryd";
import {
  fetchRydEvidence,
  loadRydGoogleIntegration,
  readRydSubmissions,
} from "@/lib/server/ryd-google";

/**
 * Stream a file someone uploaded through the form. Only files named in the
 * form's own responses are served: the connected account can read the whole
 * of its Drive, and this route must not become a way to browse it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const context = await rydContext();
  if ("response" in context) return context.response;
  const { fileId } = await params;
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return notFound();

  const [settings, integration] = await Promise.all([
    loadRydSettings(context.admin),
    loadRydGoogleIntegration(),
  ]);
  if (!integration || !settings.formId) return notFound();
  try {
    const { submissions } = await readRydSubmissions(
      integration,
      settings.formId,
      { signal: request.signal },
    );
    if (!submissions.some((submission) => submission.fileIds.includes(fileId)))
      return notFound();
    const file = await fetchRydEvidence(integration, fileId, request.signal);
    const name = file.name.replace(/["\\\r\n]/g, "_");
    return new Response(file.body, {
      headers: {
        "content-type": file.mimeType,
        "content-disposition": `${file.inline ? "inline" : "attachment"}; filename="${name}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy":
          "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (error) {
    if (request.signal.aborted)
      return apiError(
        499,
        "SERVICE_UNAVAILABLE",
        "The file request was cancelled.",
      );
    console.error("RY-D evidence could not be fetched", error);
    return apiError(
      502,
      "SERVICE_UNAVAILABLE",
      "Google Drive didn't return that file.",
    );
  }
}
