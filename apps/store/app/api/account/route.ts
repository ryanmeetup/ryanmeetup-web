import { handleAccountStatus } from "@/lib/customer-account/account-status";
import { getCustomerAccountSession } from "@/lib/customer-account/runtime";

export const runtime = "nodejs";

/** Who is signed in, for the header's account menu. */
export function GET(request: Request) {
  return handleAccountStatus(request, { loadSession: () => getCustomerAccountSession(request) });
}
