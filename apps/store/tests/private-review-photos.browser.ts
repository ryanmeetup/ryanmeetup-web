import { expect, test } from "@playwright/test";

// The isolated server has complete synthetic configuration; the photo switch is explicitly off.
for (const path of [
  "/api/reviews/photos?productId=100&photoId=00000000-0000-4000-8000-000000000001",
  "/api/reviews/photos/selection?reviewId=00000000-0000-4000-8000-000000000002",
]) {
  test(`private photo read stays closed without enabling collection: ${path.split("?")[0]}`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(503);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response.headers()["location"]).toBeUndefined();
    expect(await response.json()).toEqual({ error: "Review photos are temporarily unavailable. Please try again later." });
  });
}
