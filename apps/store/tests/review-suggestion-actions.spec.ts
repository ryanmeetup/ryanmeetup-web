import { expect, test } from "@playwright/test";
import type { CustomerAccountSession } from "../lib/customer-account/storage";
import type { CustomerSessionResult } from "../lib/customer-account/session";
import { handleReviewSuggestionAction } from "../lib/review-suggestion-actions";
import type { ReviewSuggestionStorage } from "../lib/review-suggestion-storage";
import { reviewViewerKey } from "../lib/review-viewer";

const session = { sessionHash: "a".repeat(64), subject: "buyer-a", createdAt: 1, expiresAt: 2, revision: 0 } as CustomerAccountSession;
const request = (data: unknown = { action: "dismiss", lineId: "101" }, headers: Record<string, string> = {}) => new Request("https://store.test/api/reviews/suggestions", {
  method: "POST", headers: { Origin: "https://store.test", "Content-Type": "application/json", "X-Review-Viewer": reviewViewerKey(session), ...headers }, body: JSON.stringify(data),
});
function setup() {
  const calls: unknown[] = [];
  const storage: ReviewSuggestionStorage = { dismissedLines: async () => [], change: async (...args) => { calls.push(args); } };
  const services = { storage, loadSession: async (): Promise<CustomerSessionResult> => ({ status: "authenticated", session }),
    findRecent: async () => ({ status: "found" as const, buyer: { firstName: "Ryan", lastName: null }, purchases: [{
      lineId: "101", orderId: "100", productId: "200", variantId: null, productTitle: "Shirt", variantTitle: null,
      label: "Order #100", orderLabel: "#100", quantity: 1, shippedAt: null,
    }] }) };
  return { services, calls };
}

test("dismiss and restore use the authenticated buyer; restores need no fresh purchase discovery", async () => {
  const { services, calls } = setup();
  expect((await handleReviewSuggestionAction(request(), services)).status).toBe(200);
  services.findRecent = async () => { throw new Error("No discovery on restore"); };
  const response = await handleReviewSuggestionAction(request({ action: "restore", lineId: "101" }), services);
  expect(await response.json()).toEqual({ status: "restored" });
  expect(calls).toEqual([["buyer-a", "101", "dismiss"], ["buyer-a", "101", "restore"]]);
  expect(response.headers.get("cache-control")).toContain("no-store");
});

test("rejects foreign purchases, identities, malformed actions and cross-origin changes", async () => {
  const { services, calls } = setup();
  for (const data of [{ action: "dismiss", lineId: "999" }, { action: "dismiss", lineId: "101", subject: "buyer-b" },
    { action: "dismiss", lineId: 101 }, { action: "mute-all", lineId: "101" }, { action: "dismiss", lineId: "0" }]) {
    expect((await handleReviewSuggestionAction(request(data), services)).status).toBe(data.lineId === "999" ? 404 : 400);
  }
  expect((await handleReviewSuggestionAction(request(undefined, { Origin: "https://elsewhere.test" }), services)).status).toBe(403);
  expect((await handleReviewSuggestionAction(request(undefined, { "X-Review-Viewer": "b".repeat(64) }), services)).status).toBe(409);
  expect(calls).toEqual([]);
});

test("signed-out, changed and failed sessions never save a dismissal", async () => {
  const { services, calls } = setup();
  services.loadSession = async () => ({ status: "sign_in_required" });
  expect((await handleReviewSuggestionAction(request(), services)).status).toBe(401);
  let loads = 0;
  services.loadSession = async () => ({ status: "authenticated", session: ++loads === 1 ? session : { ...session, subject: "buyer-b" } });
  expect((await handleReviewSuggestionAction(request(), services)).status).toBe(409);
  services.loadSession = async () => { throw new Error("unavailable"); };
  expect((await handleReviewSuggestionAction(request(), services)).status).toBe(503);
  expect(calls).toEqual([]);
});

test("storage failures return a retryable error without claiming success", async () => {
  const { services } = setup();
  services.storage.change = async () => { throw new Error("private database detail"); };
  const response = await handleReviewSuggestionAction(request(), services);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private database detail");
});
