import { expect, test } from "@playwright/test";
import { POST } from "../app/api/reviews/preview/route";
import { POST as submitReview } from "../app/api/reviews/route";
import { isReviewPreviewEnabled, resolveReviewProvider, reviewPreviewCookie } from "../lib/review-provider";

const envKeys = ["VERCEL_ENV", "REVIEWS_PREVIEW_ENABLED", "REVIEWS_PROVIDER", "JUDGEME_SHOP_DOMAIN"] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
let requests: string[];

test.beforeEach(() => {
  process.env.VERCEL_ENV = "preview";
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

function choose(provider: unknown, origin: string | null = "https://store.test") {
  return POST(new Request("https://store.test/api/reviews/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify({ provider }),
  }));
}

function submit(cookie?: string) {
  return submitReview(new Request("https://store.test/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://store.test", ...(cookie ? { Cookie: cookie } : {}) },
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

test("Vercel production ignores cookies even with the testing flag enabled", async () => {
  process.env.VERCEL_ENV = "production";
  expect(isReviewPreviewEnabled()).toBe(false);
  expect(resolveReviewProvider("custom")).toBe("judgeme");
  const response = await choose("custom");
  expect(response.status).toBe(404);
  expect(response.headers.get("set-cookie")).toBeNull();
  process.env.REVIEWS_PROVIDER = "custom";
  expect((await submit(`${reviewPreviewCookie}=judgeme`)).status).toBe(503);
  expect(requests).toEqual([]);
});

test("a disabled preview flag closes the endpoint and ignores forged preferences", async () => {
  process.env.REVIEWS_PREVIEW_ENABLED = "false";
  expect(isReviewPreviewEnabled()).toBe(false);
  expect((await choose("custom")).status).toBe(404);
  process.env.REVIEWS_PROVIDER = "custom";
  expect(resolveReviewProvider("judgeme")).toBe("custom");
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
    const response = await POST(new Request("http://localhost:3202/api/reviews/preview", {
      method: "POST",
      headers: {
        Host: "preview.test:3202",
        Origin: `${protocol}://preview.test:3202`,
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
  const response = await POST(new Request("http://localhost:3202/api/reviews/preview", {
    method: "POST",
    headers: { Host: "preview.test", Origin: "http://preview.test", "X-Forwarded-Proto": "https", "Content-Type": "application/json" },
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
  const malformed = await POST(new Request("https://store.test/api/reviews/preview", {
    method: "POST", headers: { Origin: "https://store.test", "Content-Type": "application/json" }, body: "{",
  }));
  expect(malformed.status).toBe(400);
  const wrongFormat = await POST(new Request("https://store.test/api/reviews/preview", {
    method: "POST", headers: { Origin: "https://store.test", "Content-Type": "text/plain" }, body: "custom",
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
  expect(resolveReviewProvider("invented")).toBeNull();
  expect((await submit(`${reviewPreviewCookie}=invented`)).status).toBe(503);
  expect(requests).toEqual([]);
});
