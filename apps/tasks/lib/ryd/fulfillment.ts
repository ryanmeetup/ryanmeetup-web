import type { RydDraft } from "./emails";
import type { RydSheetReport } from "./sheet-reconciliation";

/** Browser projection of one immutable server-owned fulfillment manifest. */
export type RydFulfillmentSnapshot = {
  id: string;
  recipient: string;
  preparedAt: string;
  orderCount: number;
  verifiedCount: number;
  /** An older unsent manifest must be cancelled before preparing a new file. */
  requiresRebuild: boolean;
  draft: RydDraft;
};

export type RydFulfillmentResult = {
  changed: boolean;
  verifiedCount: number;
  orderCount: number;
  sheet: RydSheetReport;
};
