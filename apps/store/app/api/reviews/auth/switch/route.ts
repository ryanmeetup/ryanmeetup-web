import { switchCustomerAccount } from "@/lib/customer-account/http";

export const runtime = "nodejs";
// Sign out here and get Shopify's logout address, so the next sign-in can pick another account.
export const POST = switchCustomerAccount;
