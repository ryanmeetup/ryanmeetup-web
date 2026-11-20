import type { ReviewOperation } from "@ryanmeetup/reviews";

export type ReviewStorageFailure = "storage_error" | "invalid_response" | "unexpected_error";

// Keep the log vocabulary fixed. Unknown provider values may contain private
// content, even in a field named `code`; never log arbitrary error properties.
const knownCodes = new Set([
  "42501", "42P01", "42703", "42883", "23502", "23505", "23503", "23514", "22P02", "22023",
  "40001", "40P01", "53300", "53400", "57014", "57P01", "08000", "08003", "08006", "XX000",
  "PGRST000", "PGRST001", "PGRST002", "PGRST003", "PGRST202", "PGRST203", "PGRST204", "PGRST205", "PGRST301", "PGRST302",
]);

/** Store server only. Pass fixed operation metadata, never a command, result or raw error. */
export function reportReviewStorageFailure(operation: ReviewOperation, failure: ReviewStorageFailure, code?: string) {
  const event = {
    event: "store_review_operation_failed",
    operation,
    failure,
    code: code === undefined || code === "" ? null : knownCodes.has(code) ? code : "unrecognized",
  };
  try {
    console.error(JSON.stringify(event));
  } catch {
    // Observability must not replace the original storage failure or affect its caller.
  }
}
