import { ANONYMOUS_REVIEWER_NAME, buyerReviewTimestamp, decodeBuyerReviewCursor, reviewDisplayName, reviewSubmissionSchema } from "@ryanmeetup/reviews";
import { createHash } from "node:crypto";
import type { CustomerSessionResult } from "./customer-account/session";
import { sameCustomerAccountSession } from "./customer-account/storage";
import { hasJsonBody, isSameOriginRead, isSameOriginRequest, privateJson as reply, readBoundedJsonObject } from "./request-guard";
import type { ReviewBackend } from "./review-backend";
import type { ReviewBuyerNameLookup } from "./review-purchases";
import type { MyReviewView } from "./my-review-view";

const unavailable = () => reply(503, { error: "Your reviews are temporarily unavailable. Please try again later." });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type MyReviewServices = { loadSession: () => Promise<CustomerSessionResult>; findBuyerName: ReviewBuyerNameLookup; backend: ReviewBackend | null };

async function sessionResult(load: MyReviewServices["loadSession"]) {
  return load().catch((): CustomerSessionResult => ({ status: "unavailable" }));
}
function sessionFailure(session: CustomerSessionResult) {
  return session.status === "sign_in_required" ? reply(401, { error: "Sign in to manage your reviews." }) : unavailable();
}
async function recheckSession(first: Extract<CustomerSessionResult, { status: "authenticated" }>, load: MyReviewServices["loadSession"]) {
  const current = await sessionResult(load);
  return current.status === "authenticated" && !sameCustomerAccountSession(first.session,current.session) ? { status:"unavailable" as const } : current;
}

/** Initial server rendering and client paging share the same private buyer boundary. */
export async function loadMyReviewPage(cursor: string | null, { loadSession, backend, findBuyerName }: MyReviewServices): Promise<
  { status: "ready"; view: MyReviewView } | { status: "sign_in_required" | "unavailable" }
> {
  if (!backend) return { status: "unavailable" };
  const session = await sessionResult(loadSession);
  if (session.status !== "authenticated") return session;
  try {
    const [page,buyerName] = await Promise.all([
      backend({ operation: "reviews.mine", subject: session.session.subject, cursor }),
      findBuyerName(session.session).catch(() => null),
    ]);
    const current = await recheckSession(session,loadSession);
    return current.status === "authenticated" ? { status:"ready",view:{page,buyerName,
      // Equality marker only; neither a session lookup hash nor an authentication credential.
      viewerKey:createHash("sha256").update("my-review-view:").update(session.session.sessionHash).digest("hex")}} : current;
  } catch { return { status: "unavailable" }; }
}

export async function handleMyReviewPage(request: Request, services: MyReviewServices) {
  if (!isSameOriginRead(request)) return reply(403, { error: "Manage reviews from this storefront." });
  const params = new URL(request.url).searchParams;
  const cursor = params.get("cursor");
  if ([...params.keys()].some((key) => key !== "cursor") || params.getAll("cursor").length > 1 || (cursor !== null && !decodeBuyerReviewCursor(cursor))) {
    return reply(400, { error: "That review page could not be read." });
  }
  const result = await loadMyReviewPage(cursor, services);
  return result.status === "ready" ? reply(200, { ...result.view }) : sessionFailure(result);
}

/** The authenticated subject and public name come only from the server. */
export async function handleMyReviewAction(request: Request, { loadSession, findBuyerName, backend }: MyReviewServices): Promise<Response> {
  if (!backend) return unavailable();
  if (!isSameOriginRequest(request)) return reply(403, { error: "Manage reviews from this storefront." });
  if (!hasJsonBody(request)) return reply(415, { error: "That change could not be read. Please try again." });
  const parsed = await readBoundedJsonObject(request, 48 * 1024);
  if (parsed.status === "too-large") return reply(413, { error: "That review change is too large." });
  if (parsed.status !== "valid") return reply(400, { error: "That change could not be read. Please try again." });
  const { action, reviewId, expectedUpdatedAt, ...fields } = parsed.value;
  if (typeof reviewId !== "string" || !uuid.test(reviewId) || !buyerReviewTimestamp(expectedUpdatedAt) || (action !== "edit" && action !== "withdraw")) {
    return reply(400, { error: "That change could not be read. Please try again." });
  }
  const submission = action === "edit" ? reviewSubmissionSchema(fields) : null;
  if (action === "edit" ? !submission : Object.keys(fields).length) return reply(400, { error: "Please complete every required field." });
  const session = await sessionResult(loadSession);
  if (session.status !== "authenticated") return sessionFailure(session);
  const subject = session.session.subject;
  try {
    // A direct scoped read also finds reviews beyond the first page.
    const existing = await backend({ operation: "review.mine", subject, reviewId });
    if (!existing) return reply(404, { error: "That review isn't on your account." });
    if (existing.updatedAt !== expectedUpdatedAt) return reply(409, { error: "This review changed. Refresh your reviews before deciding again." });
    let displayName = existing.current.displayName;
    if (submission?.nameStyle === "anonymous") displayName = ANONYMOUS_REVIEWER_NAME;
    else if (submission && submission.nameStyle !== existing.current.nameStyle) {
      const name = await findBuyerName(session.session).catch(() => null);
      if (!name?.firstName) return reply(503, { error: "Changing how your name appears is temporarily unavailable. Keep your current choice or go anonymous." });
      displayName = reviewDisplayName(submission.nameStyle, name);
    }
    const current = await recheckSession(session,loadSession);
    if (current.status !== "authenticated") return sessionFailure(current);
    const outcome = action === "withdraw"
      ? await backend({ operation: "review.withdraw", subject, reviewId, expectedUpdatedAt })
      : await backend({ operation: "review.edit", subject, reviewId, expectedUpdatedAt, submission: submission!, displayName });
    if (outcome === "pending" || outcome === "withdrawn") return reply(200, { status: outcome });
    if (outcome === "conflict") return reply(409, { error: "This review changed. Refresh your reviews before deciding again." });
    if (outcome === "closed") return reply(409, { error: "This review can't be edited right now. Refresh your reviews." });
    return reply(404, { error: "That review isn't on your account." });
  } catch { return unavailable(); }
}
