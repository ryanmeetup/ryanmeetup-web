import "server-only";

/** Database failures carry only the Postgres code; row values may hold review text or buyer IDs. */
export class StoreReviewDatabaseError extends Error {
  constructor(readonly code?: string) { super("Store review storage failed."); }
}
