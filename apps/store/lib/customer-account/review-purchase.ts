import { createCustomerAccountApi, discoverCustomerAccountApi } from "./api";
import { getCustomerAccountConfiguration } from "./config";
import { evaluateReviewPurchase } from "./purchase-eligibility";
import type { ReviewPurchaseEligibility } from "./purchase-eligibility";
import { customerPurchaseId, readCustomerPurchase } from "./purchase-reader";
import { getCustomerAccountSession } from "./runtime";
import { sameCustomerAccountSession } from "./storage";

/** Server authorization boundary for a future review write, not a browser proof. */
export async function getReviewPurchaseEligibility(request: Request, references: {
  orderId: string; lineId: string; productId: string;
}): Promise<ReviewPurchaseEligibility> {
  if (![references.orderId, references.lineId, references.productId].every(customerPurchaseId)) return { status: "ineligible", reason: "not_found" };
  const identity = await getCustomerAccountSession(request);
  if (identity.status !== "authenticated") return { status: identity.status };
  const configuration = getCustomerAccountConfiguration();
  if (configuration.status !== "configured") return { status: "unavailable" };
  try {
    const endpoint = await discoverCustomerAccountApi(configuration.config);
    if (!endpoint) return { status: "unavailable" };
    const query = createCustomerAccountApi({ config: configuration.config, endpoint, accessToken: identity.session.tokens.accessToken });
    const read = await readCustomerPurchase(query, references.orderId);
    if (identity.session.expiresAt <= Date.now()) return { status: "sign_in_required" };
    if (identity.session.accessExpiresAt <= Date.now()) return { status: "unavailable" };
    if (read.status === "not_found" || read.status === "not_owned") return { status: "ineligible", reason: read.status };
    if (read.status !== "found") return { status: "unavailable" };
    const result = evaluateReviewPurchase(read.purchase, { ...references, shopId: configuration.config.shopId });
    if (result.status !== "eligible") return result;
    // Purchase pagination may outlive a local sign-out. Recheck the stored
    // session before returning authorization, without accepting browser proofs.
    const current = await getCustomerAccountSession(request);
    if (current.status !== "authenticated") return { status: current.status };
    if (!sameCustomerAccountSession(identity.session, current.session)) return { status: "unavailable" };
    return result;
  } catch { return { status: "unavailable" }; }
}
