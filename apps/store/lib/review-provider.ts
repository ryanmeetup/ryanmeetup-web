export type ReviewProvider = "judgeme" | "custom";

/** Server-only configuration, shared by reads, collection, and submission. */
export function getReviewProvider(): ReviewProvider | null {
  const value = process.env.REVIEWS_PROVIDER?.trim();
  if (!value) return "judgeme";
  if (value === "judgeme" || value === "custom") return value;
  // A typo must not silently reopen the legacy anonymous submission path.
  return null;
}
