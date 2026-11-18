import { customerAuthBackendPath, customerAuthCommandSchema, customerAuthResultSchema } from "@ryanmeetup/reviews";
import type { CustomerAuthCommand, CustomerAuthResults } from "@ryanmeetup/reviews";
import { createServiceClient } from "../service-client";

export class CustomerAuthBackendError extends Error {
  constructor() { super("Customer sign-in storage is temporarily unavailable."); }
}

/**
 * Server-only client for encrypted customer sign-in storage. Unavailability
 * must never look like a missing buyer session, so every failure throws.
 */
export function createCustomerAuthBackend({ origin, token, fetcher }: { origin: string; token: string; fetcher?: typeof fetch }) {
  return createServiceClient<CustomerAuthCommand, CustomerAuthResults>({
    origin, token, fetcher, path: customerAuthBackendPath, commandSchema: customerAuthCommandSchema, resultSchema: customerAuthResultSchema,
    maxResponseBytes: 96 * 1024,
    fail: () => new CustomerAuthBackendError(),
  });
}
