import type { RydDraft } from "./emails";

export const RYD_FULFILLMENT_LIMIT = 5000;
export const RYD_FULFILLMENT_BODY_BYTES = 512 * 1024;

/** Generated for this dialog only; no saved email, CSV or reservation. */
export type RydFulfillmentPreview = {
  recipient: string;
  generatedAt: string;
  orderCount: number;
  filename: string;
  csv: string;
  draft: RydDraft;
};
