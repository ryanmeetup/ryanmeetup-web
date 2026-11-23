import type { CustomerSessionResult } from "./customer-account/session";
import { sameCustomerAccountSession } from "./customer-account/storage";
import type { findRecentReviewablePurchases } from "./review-purchases";
import { hasJsonBody, isSameOriginRequest, privateJson, readBoundedJsonObject } from "./request-guard";
import { isSuggestionLineId, type ReviewSuggestionStorage } from "./review-suggestion-storage";
import { matchesReviewViewer, reviewViewerChanged } from "./review-viewer";

const unavailable = () => privateJson(503, { error: "Your review reminders could not be updated. Please try again." });

/** Identity is always session-owned; a dismissal never changes review eligibility. */
export async function handleReviewSuggestionAction(request: Request, { loadSession, storage, findRecent }: {
  loadSession: () => Promise<CustomerSessionResult>;
  storage: ReviewSuggestionStorage | null;
  findRecent: typeof findRecentReviewablePurchases;
}): Promise<Response> {
  if (!isSameOriginRequest(request)) return privateJson(403, { error: "Manage review reminders from this storefront." });
  if (!hasJsonBody(request)) return privateJson(415, { error: "That reminder change could not be read." });
  const parsed = await readBoundedJsonObject(request, 1024);
  if (parsed.status === "too-large") return privateJson(413, { error: "That reminder change is too large." });
  if (parsed.status !== "valid") return privateJson(400, { error: "That reminder change could not be read." });
  const { action, lineId, ...extra } = parsed.value;
  if ((action !== "dismiss" && action !== "restore") || !isSuggestionLineId(lineId) || Object.keys(extra).length || !request.headers.get("x-review-viewer")) {
    return privateJson(400, { error: "That reminder change could not be read. Refresh and try again." });
  }
  if (!storage) return unavailable();
  try {
    const session = await loadSession();
    if (session.status === "sign_in_required") return privateJson(401, { error: "Sign in to manage your review reminders." });
    if (session.status !== "authenticated") return unavailable();
    if (!matchesReviewViewer(request, session.session)) return reviewViewerChanged();
    if (action === "dismiss") {
      const recent = await findRecent(session.session);
      if (recent.status !== "found") return unavailable();
      if (!recent.purchases.some((purchase) => purchase.lineId === lineId)) return privateJson(404, { error: "That purchase is no longer in your review reminders. Refresh and try again." });
    }
    const current = await loadSession();
    if (current.status !== "authenticated" || !sameCustomerAccountSession(session.session, current.session)) return reviewViewerChanged();
    await storage.change(session.session.subject, lineId, action);
    return privateJson(200, { status: action === "dismiss" ? "dismissed" : "restored" });
  } catch { return unavailable(); }
}
