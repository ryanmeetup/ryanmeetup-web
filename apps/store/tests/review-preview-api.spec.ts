import { expect, test } from "@playwright/test";
import { POST } from "../app/api/reviews/preview/route";
import { POST as submitReview } from "../app/api/reviews/route";
import { isReviewPreviewEnabled, resolveReviewProvider, reviewPreviewCookie } from "../lib/review-provider";

const envKeys = ["VERCEL", "VERCEL_ENV", "REVIEWS_PREVIEW_ENABLED", "REVIEWS_PROVIDER", "JUDGEME_SHOP_DOMAIN"] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
let requests: string[];

test.beforeEach(() => {
  delete process.env.VERCEL; delete process.env.VERCEL_ENV;
  process.env.REVIEWS_PREVIEW_ENABLED = "true";
  process.env.REVIEWS_PROVIDER = "judgeme";
  process.env.JUDGEME_SHOP_DOMAIN = "reviews.test";
  requests = [];
  globalThis.fetch = async (input) => { requests.push(String(input)); return Response.json({}); };
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function choose(provider: unknown, origin: string | null = "https://localhost:3102") {
  return POST(new Request("https://localhost:3102/api/reviews/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify({ provider }),
  }));
}

function submit(cookie?: string) {
  return submitReview(new Request("https://localhost:3102/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://localhost:3102", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ productId: "gid://shopify/Product/123", rating: 5, body: "Great gear.", name: "Ryan", email: "ryan@example.com" }),
  }));
}

test("preview writes an expiring browser preference and can restore the environment default", async () => {
  for (const provider of ["custom", "judgeme"]) {
    const response = await choose(provider);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.cookies.get(reviewPreviewCookie)).toMatchObject({ value: provider, httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 86400 });
  }
  const reset = await choose("default");
  expect(reset.status).toBe(200);
  expect(reset.cookies.get(reviewPreviewCookie)).toMatchObject({ value: "", maxAge: 0, path: "/" });
  expect(requests).toEqual([]);
});

test("no Vercel deployment accepts review testing, even on a loopback Host header", async () => {
  for (const environment of ["preview", "production"]) {
    process.env.VERCEL = "1"; process.env.VERCEL_ENV = environment;
    expect(isReviewPreviewEnabled("localhost:3102")).toBe(false);
    expect(resolveReviewProvider("custom", "localhost:3102")).toBe("judgeme");
    const response = await choose("custom");
    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  }
  process.env.REVIEWS_PROVIDER = "custom";
  expect((await submit(`${reviewPreviewCookie}=judgeme`)).status).toBe(503);
  expect(requests).toEqual([]);
});

test("only a loopback host can use review testing", async () => {
  for (const host of ["localhost", "localhost:3102", "127.0.0.1:3000", "[::1]:3000", "LOCALHOST:3002"]) expect(isReviewPreviewEnabled(host)).toBe(true);
  for (const host of [null, "", "store.ryanmeetup.com", "preview.test:3202", "localhost.attacker.test", "127.0.0.1.attacker.test", "localhost:3102@attacker.test", "10.0.0.5:3000"]) {
    expect(isReviewPreviewEnabled(host)).toBe(false);
  }
  const deployed = await POST(new Request("https://store.ryanmeetup.com/api/reviews/preview", {
    method: "POST", headers: { Origin: "https://store.ryanmeetup.com", "Content-Type": "application/json" }, body: JSON.stringify({ provider: "custom" }),
  }));
  expect(deployed.status).toBe(404);
  expect(deployed.headers.get("set-cookie")).toBeNull();
  // A forged preference on a deployed host falls back to the configured provider.
  expect(resolveReviewProvider("custom", "store.ryanmeetup.com")).toBe("judgeme");
});

test("a local production build needs the testing flag", async () => {
  process.env.REVIEWS_PREVIEW_ENABLED = "false";
  expect(isReviewPreviewEnabled("localhost:3102")).toBe(process.env.NODE_ENV === "development");
});

test("Vercel production ignores cookies even with the testing flag enabled", async () => {
  process.env.VERCEL = "1"; process.env.VERCEL_ENV = "production";
  expect(isReviewPreviewEnabled("localhost:3102")).toBe(false);
  expect(resolveReviewProvider("custom", "localhost:3102")).toBe("judgeme");
  const response = await choose("custom");
  expect(response.status).toBe(404);
  expect(response.headers.get("set-cookie")).toBeNull();
  process.env.REVIEWS_PROVIDER = "custom";
  expect((await submit(`${reviewPreviewCookie}=judgeme`)).status).toBe(503);
  expect(requests).toEqual([]);
});

test("a disabled preview flag closes the endpoint and ignores forged preferences", async () => {
  process.env.REVIEWS_PREVIEW_ENABLED = "false";
  expect(isReviewPreviewEnabled("localhost:3102")).toBe(false);
  expect((await choose("custom")).status).toBe(404);
  process.env.REVIEWS_PROVIDER = "custom";
  expect(resolveReviewProvider("judgeme", "localhost:3102")).toBe("custom");
  expect((await submit(`${reviewPreviewCookie}=judgeme`)).status).toBe(503);
  expect(requests).toEqual([]);
});

test("cross-origin and missing-origin attempts cannot change the preference", async () => {
  for (const origin of ["https://other.test", null]) {
    const response = await choose("custom", origin);
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  }
});

test("origin checks support Next's internal host and HTTPS proxy protocol", async () => {
  for (const protocol of ["http", "https"]) {
    const response = await POST(new Request("http://0.0.0.0:3202/api/reviews/preview", {
      method: "POST",
      headers: {
        Host: "localhost:3202",
        Origin: `${protocol}://localhost:3202`,
        "X-Forwarded-Proto": protocol,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ provider: "custom" }),
    }));
    expect(response.status).toBe(200);
    expect(response.cookies.get(reviewPreviewCookie)?.secure).toBe(protocol === "https");
  }
});

test("same-host requests with a different browser scheme are rejected", async () => {
  const response = await POST(new Request("http://0.0.0.0:3202/api/reviews/preview", {
    method: "POST",
    headers: { Host: "localhost", Origin: "http://localhost", "X-Forwarded-Proto": "https", "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "custom" }),
  }));
  expect(response.status).toBe(403);
  expect(response.headers.get("set-cookie")).toBeNull();
});

test("invalid and malformed choices are rejected without changing cookies", async () => {
  for (const provider of ["other", "", null, true, {}, ["custom"]]) {
    const response = await choose(provider);
    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  }
  const malformed = await POST(new Request("https://localhost:3102/api/reviews/preview", {
    method: "POST", headers: { Origin: "https://localhost:3102", "Content-Type": "application/json" }, body: "{",
  }));
  expect(malformed.status).toBe(400);
  const wrongFormat = await POST(new Request("https://localhost:3102/api/reviews/preview", {
    method: "POST", headers: { Origin: "https://localhost:3102", "Content-Type": "text/plain" }, body: "custom",
  }));
  expect(wrongFormat.status).toBe(415);
});

test("preview selection applies to submissions while another browser retains its default", async () => {
  expect((await submit(`${reviewPreviewCookie}=custom`)).status).toBe(503);
  expect(requests).toEqual([]);
  expect((await submit()).status).toBe(200);
  expect(requests).toEqual(["https://judge.me/api/v1/reviews"]);
  requests = [];
  process.env.REVIEWS_PROVIDER = "custom";
  expect((await submit(`${reviewPreviewCookie}=judgeme`)).status).toBe(200);
  expect(requests).toEqual(["https://judge.me/api/v1/reviews"]);
});

test("an invalid cookie cannot override a closed default configuration", async () => {
  process.env.REVIEWS_PROVIDER = "typo";
  expect(resolveReviewProvider("invented", "localhost:3102")).toBeNull();
  expect((await submit(`${reviewPreviewCookie}=invented`)).status).toBe(503);
  expect(requests).toEqual([]);
});
