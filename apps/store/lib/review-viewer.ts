import { createHash } from "node:crypto";
import type { CustomerAccountSession } from "./customer-account/storage";
import { privateJson } from "./request-guard";

/** Equality marker only. Never a session lookup hash, buyer ID or authentication credential. */
export const reviewViewerKey = (session: CustomerAccountSession) => createHash("sha256")
  .update("my-review-view:").update(session.sessionHash).digest("hex");

/** An editor can bind its intent to the account it opened under; identity still comes from authentication. */
export const matchesReviewViewer = (request: Request, session: CustomerAccountSession) => {
  const expected = request.headers.get("x-review-viewer");
  return expected === null || expected === reviewViewerKey(session);
};
export const reviewViewerChanged = () => privateJson(409, { code: "viewer_changed", error: "Your account changed. Close this review and refresh before trying again." });
