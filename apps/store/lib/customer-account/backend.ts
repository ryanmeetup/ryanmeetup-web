import { customerAuthBackendPath, customerAuthCommandSchema, customerAuthResultSchema } from "@ryanmeetup/reviews";
import type { CustomerAuthCommand, CustomerAuthResults } from "@ryanmeetup/reviews";
import { publicHttpsUrl } from "./config";

export class CustomerAuthBackendError extends Error {
  constructor() { super("Customer sign-in storage is temporarily unavailable."); }
}

/** Server-only credential. No Supabase key is used or accepted by this client. */
export function createCustomerAuthBackend({ origin, token, fetcher = fetch }: {
  origin: string;
  token: string;
  fetcher?: typeof fetch;
}) {
  const url = publicHttpsUrl(origin);
  if (!url || url.pathname !== "/" || url.search || url.port || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new CustomerAuthBackendError();
  const endpoint = new URL(customerAuthBackendPath, url.origin).href;

  return async function execute<Command extends CustomerAuthCommand>(command: Command): Promise<CustomerAuthResults[Command["operation"]]> {
    if (!customerAuthCommandSchema(command)) throw new CustomerAuthBackendError();
    try {
      const response = await fetcher(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(command), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new CustomerAuthBackendError();
      const text = await response.text();
      if (Buffer.byteLength(text) > 96 * 1024) throw new CustomerAuthBackendError();
      const result = customerAuthResultSchema<Command["operation"]>(command.operation, JSON.parse(text));
      if (!result) throw new CustomerAuthBackendError();
      return result.data;
    } catch {
      // Never copy upstream errors, URLs, response bodies, or bearer tokens into
      // diagnostics. Unavailability must not look like a missing buyer session.
      throw new CustomerAuthBackendError();
    }
  };
}
