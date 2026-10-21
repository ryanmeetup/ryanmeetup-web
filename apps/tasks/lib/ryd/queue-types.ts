import type { RydMatchSuggestion, RydSubmission } from "./matching";
import type { RydOrderStatus } from "./orders";

/** What the RY-D page receives from the server, and re-reads after each change. */

export type RydSettings = {
  /** The RY-dentification form's ID, from its editor link. */
  formId: string | null;
  fulfillmentEmail: string | null;
};

export type RydQueueOrder = {
  orderId: string;
  salesOrder: string;
  orderedAt: string;
  firstName: string;
  lastName: string;
  /** As fulfillment typed it, for display; matching uses the normalized one. */
  displayEmail: string;
  email: string;
  total: string;
  status: RydOrderStatus;
  note: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  /** Server revision used to refuse edits based on stale queue state. */
  updatedAt?: string;
  lastEmailedAt: string | null;
  /** Fulfillment has had a file clearing this order; its decision is final. */
  sentToFulfillment: boolean;
  /** When a verified order went off to be made, and when it was finished. */
  productionSentAt: string | null;
  doneAt: string | null;
  linkedKeys: string[];
  suggestion: RydMatchSuggestion | null;
};

/** How often someone with no matching order has been emailed, and when last. */
export type RydSubmitterContact = {
  attempts: number;
  lastContactedAt: string;
};

export type RydSheetState =
  | { status: "unconfigured"; accountEmail: string }
  | { status: "disconnected" }
  | { status: "error"; message: string; accountEmail: string }
  | { status: "ok"; accountEmail: string };

export type RydQueue = {
  orders: RydQueueOrder[];
  submissions: RydSubmission[];
  /** Responses set aside, usually duplicates; kept so they can be restored. */
  dismissed: RydSubmission[];
  /** Contact attempts, keyed by the submitter's normalized email. */
  contacts: Record<string, RydSubmitterContact>;
  sheet: RydSheetState;
  settings: RydSettings;
  clearedCount: number;
  lastBatch: {
    sentAt: string;
    recipient: string | null;
    orderCount: number;
    verifiedCount: number;
  } | null;
  /** False until the migration that creates the RY-D tables is applied. */
  installed: boolean;
};
