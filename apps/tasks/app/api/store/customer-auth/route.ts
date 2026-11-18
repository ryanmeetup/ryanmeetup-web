import { NextResponse } from "next/server";
import { customerAuthCommandSchema } from "@/lib/api-schema";
import { apiError, databaseFailure, privateResponse } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import { authorizeStoreService } from "@/lib/server/store-service-authorization";
import { CustomerAuthDatabaseError, executeStoreCustomerAuth } from "@/lib/server/store-customer-auth/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorization = authorizeStoreService(request);
  if ("response" in authorization) return privateResponse(authorization.response);
  const parsed = await readJson(request, customerAuthCommandSchema, { source: "service", maxBytes: 96 * 1024 });
  if ("response" in parsed) return privateResponse(parsed.response);
  const command = parsed.data;
  const scope = authorization.scope;
  if (command.scope.shopId !== scope.shopId || command.scope.clientId !== scope.clientId ||
    command.scope.issuer !== scope.issuer || command.scope.redirectUri !== scope.redirectUri) {
    return privateResponse(apiError(403, "FORBIDDEN", "The requested customer authentication scope is not allowed."));
  }
  const now = Date.now();
  if (("record" in command && (command.record.createdAt > now + 5000 || command.record.expiresAt <= now ||
    ("accessExpiresAt" in command.record && command.record.accessExpiresAt <= now))) ||
    (command.operation === "session.rotate" && command.accessExpiresAt <= now)) {
    return privateResponse(apiError(400, "INVALID_REQUEST", "Customer authentication timestamps are not valid."));
  }
  try {
    return privateResponse(NextResponse.json(await executeStoreCustomerAuth(authorization.admin, scope, command)));
  } catch (error) {
    // Supabase error details may contain private row values. Log the code only.
    return privateResponse(databaseFailure(request, "store_customer_auth", {
      code: error instanceof CustomerAuthDatabaseError ? error.code : undefined,
    }, { error: "Customer authentication storage is temporarily unavailable.", conflictError: "This authentication record already exists." }));
  }
}
