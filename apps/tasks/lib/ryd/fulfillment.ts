import type { RydDraft } from "./emails";
import type { RydSheetReport } from "./sheet-reconciliation";

export const RYD_FULFILLMENT_LIMIT = 5000;
export const RYD_FULFILLMENT_BODY_BYTES = 512 * 1024;

/** Browser projection of one immutable server-owned fulfillment manifest. */
export type RydFulfillmentSnapshot = {
  id: string;
  recipient: string;
  preparedAt: string;
  orderCount: number;
  verifiedCount: number;
  /** An older unsent manifest must be cancelled before preparing a new file. */
  requiresRebuild: boolean;
  /** The saved draft differs from the requested selection; replacement is explicit. */
  selectionConflict: boolean;
  draft: RydDraft;
};

export type RydFulfillmentResult = {
  changed: boolean;
  orderIds: string[];
  verifiedCount: number;
  orderCount: number;
  sheet: RydSheetReport;
};
