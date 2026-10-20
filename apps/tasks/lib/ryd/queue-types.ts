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
  contactMethod: string;
  total: string;
  status: RydOrderStatus;
  note: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  lastEmailedAt: string | null;
  linkedKeys: string[];
  suggestion: RydMatchSuggestion | null;
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
