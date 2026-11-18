import { expect, test } from "@playwright/test";
import { handleAccountStatus } from "../lib/customer-account/account-status";
import { customerAccountEmail } from "../lib/customer-account/identity";
import type { CustomerSessionResult } from "../lib/customer-account/session";
import type { CustomerAccountSession } from "../lib/customer-account/storage";

// decodeJwt only reads claims; the real ID token was verified at sign-in.
const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (claims: object) => `${part({ alg: "RS256" })}.${part(claims)}.signature`;
const session = (idToken: string) => ({ sessionHash: "a".repeat(64), subject: "buyer", createdAt: 1, expiresAt: 2, accessExpiresAt: 2, revision: 0,
  tokens: { accessToken: "private-access", refreshToken: "private-refresh", idToken } }) as CustomerAccountSession;
const request = (headers: HeadersInit = {}) => new Request("https://store.test/api/account", { headers });
const status = async (result: CustomerSessionResult | Error, headers?: HeadersInit) => {
  const response = await handleAccountStatus(request(headers), { customReviews: true, loadSession: async () => { if (result instanceof Error) throw result; return result; } });
  return { code: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
};

test("the header learns who is signed in, and nothing more", async () => {
  const signedIn = await status({ status: "authenticated", session: session(token({ sub: "buyer", email: "ryan@example.com" })) });
  expect(signedIn).toMatchObject({ code: 200, body: { status: "signed-in", email: "ryan@example.com", reviews: true } });
  expect(signedIn.cache).toContain("no-store");
  expect(JSON.stringify(signedIn.body)).not.toMatch(/private-|buyer"/);
  expect((await status({ status: "sign_in_required" })).body).toEqual({ status: "signed-out" });
  // Not configured here, or storage down: the menu offers only Shopify's account link.
  expect((await status({ status: "unavailable" })).body).toEqual({ status: "unavailable" });
  expect((await status(new Error("down"))).body).toEqual({ status: "unavailable" });
});

test("another site cannot read who is signed in", async () => {
  expect((await status({ status: "sign_in_required" }, { origin: "https://evil.test" })).code).toBe(403);
  expect((await status({ status: "sign_in_required" }, { "sec-fetch-site": "cross-site" })).code).toBe(403);
});

test("the email comes from the ID token only when it looks like one", () => {
  expect(customerAccountEmail(session(token({ email: "ryan@example.com" })))).toBe("ryan@example.com");
  for (const idToken of [token({}), token({ email: "not an email" }), token({ email: 42 }), "not-a-jwt"]) expect(customerAccountEmail(session(idToken))).toBeNull();
});
