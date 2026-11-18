import { expect, test } from "@playwright/test";
import { createReviewBackend, ReviewBackendError } from "../lib/review-backend";
import { getCustomReviews, numericProductId } from "../lib/custom-reviews";

const token = "t".repeat(43);
const review = {
  id: "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b", rating: 4, title: null, body: "Holding up well.", displayName: "Ryan L.",
  publishedAt: "2026-11-17T12:00:00.000Z", editedAt: null,
  item: { productId: "100", productTitle: "Name Tag Shirt", variantTitle: "Black / M" }, verifiedPurchase: true,
  photos: [{ url: "https://cdn.example.test/a.webp", width: 800, height: 600 }], reply: null,
};
const page = { scope: { productIds: ["100"] }, summary: { count: 25, average: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 25, 5: 0 } }, reviews: [review], nextCursor: null };

function transport(body: unknown, status = 200) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { requests, fetcher };
}

test("only an HTTPS backend origin and a well-formed service token are accepted", () => {
  for (const origin of ["http://backend.test", "https://localhost", "https://127.0.0.1", "https://backend.test/path", "https://backend.test:8443", ""]) {
    expect(() => createReviewBackend({ origin, token })).toThrow(ReviewBackendError);
  }
  expect(() => createReviewBackend({ origin: "https://backend.test", token: "short" })).toThrow(ReviewBackendError);
});

test("commands go to the private endpoint with the service credential", async () => {
  const { requests, fetcher } = transport({ data: page });
  const backend = createReviewBackend({ origin: "https://backend.test", token, fetcher });
  expect(await backend({ operation: "reviews.page", productIds: ["100"], limit: 20, cursor: null })).toEqual(page);
  expect(requests[0].url).toBe("https://backend.test/api/store/reviews");
  expect((requests[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`);
  expect(requests[0].init.redirect).toBe("error");
});

test("malformed commands never leave the server", async () => {
  const { requests, fetcher } = transport({ data: page });
  const backend = createReviewBackend({ origin: "https://backend.test", token, fetcher });
  // @ts-expect-error -- an operation outside the contract
  await expect(backend({ operation: "review.approve" })).rejects.toThrow(ReviewBackendError);
  await expect(backend({ operation: "reviews.page", productIds: ["gid://shopify/Product/1"], limit: 20, cursor: null })).rejects.toThrow(ReviewBackendError);
  expect(requests).toHaveLength(0);
});

test("unexpected, leaky, or failed responses become one generic error", async () => {
  for (const [body, status] of [
    [{ data: { ...page, reviews: [{ ...review, customerEmail: "ryan@example.com" }] } }, 200],
    [{ data: { ...page, summary: { ...page.summary, count: 3 } } }, 200],
    ["not json", 200],
    [{ error: "private database detail" }, 500],
  ] as const) {
    const backend = createReviewBackend({ origin: "https://backend.test", token, fetcher: transport(body, status).fetcher });
    const error = await backend({ operation: "reviews.page", productIds: ["100"], limit: 20, cursor: null }).catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(ReviewBackendError);
    expect((error as Error).message).toBe("Review storage is temporarily unavailable.");
  }
});

test("custom reads map a page to the storefront shape with complete totals", async () => {
  const backend = createReviewBackend({ origin: "https://backend.test", token, fetcher: transport({ data: page }).fetcher });
  expect(await getCustomReviews("gid://shopify/Product/100", backend)).toEqual({
    status: "available", averageRating: 4, count: 25,
    reviews: [{ id: review.id, rating: 4, title: "", body: "Holding up well.", reviewerName: "Ryan L.", createdAt: review.publishedAt, verified: true, photoUrls: ["https://cdn.example.test/a.webp"] }],
  });
});

test("custom reads report unavailable instead of an empty success", async () => {
  const unavailable = { status: "unavailable", averageRating: 0, count: 0, reviews: [] };
  expect(await getCustomReviews("gid://shopify/Product/100", null)).toEqual(unavailable);
  expect(await getCustomReviews("not-a-product", createReviewBackend({ origin: "https://backend.test", token, fetcher: transport({ data: page }).fetcher }))).toEqual(unavailable);
  const failing = createReviewBackend({ origin: "https://backend.test", token, fetcher: transport({ error: "down" }, 503).fetcher });
  expect(await getCustomReviews("gid://shopify/Product/100", failing)).toEqual(unavailable);
  expect(numericProductId("gid://shopify/Product/8123456789")).toBe("8123456789");
  expect(numericProductId("demo-1")).toBeNull();
});
