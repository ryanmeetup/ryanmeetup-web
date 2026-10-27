import type { RydCard, RydCardHint } from "./card";
import type { RydMatchSuggestion, RydSubmission } from "./matching";
import type { RydOrderStatus } from "./orders";
import type { RydUploadReminder } from "./upload-reminder";

/** What the RY-D page receives from the server, and re-reads after each change. */

export type RydSettings = {
  /** The RY-dentification form's ID, from its editor link. */
  formId: string | null;
  fulfillmentEmail: string | null;
  uploadReminder: RydUploadReminder;
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
  /** When production was acknowledged, and when the order was finished. */
  productionSentAt: string | null;
  doneAt: string | null;
  linkedKeys: string[];
  suggestion: RydMatchSuggestion | null;
  /** The saved card, or the draft read from the export until one is saved. */
  card: RydCard;
  cardSaved: boolean;
  cardHint: RydCardHint;
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
  | { status: "ok"; accountEmail: string; warnings?: string[] };

export type RydQueue = {
  orders: RydQueueOrder[];
  /** Includes claims on finished orders omitted from the active queue. */
  submissionClaims?: Record<string, string>;
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
  /** The workspace's time zone, which the upload reminder's slot is in. */
  timeZone: string;
  /** The reminder slot this week's file is overdue since, if not uploaded. */
  uploadDueSince: string | null;
  /** False until the migration that creates the RY-D tables is applied. */
  installed: boolean;
};
