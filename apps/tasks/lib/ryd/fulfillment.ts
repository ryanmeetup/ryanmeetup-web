import type { RydDraft } from "./emails";

/** Browser projection of one immutable server-owned fulfillment manifest. */
export type RydFulfillmentSnapshot = {
  id: string;
  recipient: string;
  preparedAt: string;
  orderCount: number;
  verifiedCount: number;
  draft: RydDraft;
};

export type RydFulfillmentResult = {
  changed: boolean;
  verifiedCount: number;
  orderCount: number;
  sheetTicks: number | null;
};
