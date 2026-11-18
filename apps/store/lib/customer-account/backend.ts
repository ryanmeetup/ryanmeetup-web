import type { SupabaseClient } from "@supabase/supabase-js";
import { customerAuthCommandSchema, customerAuthResultSchema } from "@ryanmeetup/reviews";
import type { CustomerAuthCommand, CustomerAuthResults, CustomerAuthScope } from "@ryanmeetup/reviews";

/** Database failures carry only the Postgres code; private row values never reach diagnostics. */
export class CustomerAuthBackendError extends Error {
  constructor(readonly code?: string) { super("Customer sign-in storage is temporarily unavailable."); }
}

const authorizationColumns = "state_hash,browser_binding_hash,encrypted_flow,created_at,expires_at";
const sessionColumns = "session_hash,subject,encrypted_tokens,created_at,expires_at,access_expires_at,revision";

/** Fixed operations only: no caller-selected table, columns, RPC, or scope. */
async function executeStoreCustomerAuth(admin: SupabaseClient, scope: CustomerAuthScope, command: CustomerAuthCommand) {
  const common = { p_shop_id: scope.shopId, p_client_id: scope.clientId, p_issuer: scope.issuer };
  const identity = { shop_id: scope.shopId, client_id: scope.clientId, issuer: scope.issuer };
  const authorizationProofs = "stateHash" in command ? {
    ...common, p_state_hash: command.stateHash, p_browser_binding_hash: command.browserBindingHash, p_redirect_uri: scope.redirectUri,
  } : null;
  const sessionProof = "sessionHash" in command ? { ...common, p_session_hash: command.sessionHash } : null;
  let result;
  switch (command.operation) {
    case "authorization.create": {
      const row = command.record;
      result = await admin.from("store_customer_authorizations").insert({
        ...identity, redirect_uri: scope.redirectUri, state_hash: row.stateHash, browser_binding_hash: row.browserBindingHash,
        encrypted_flow: row.encryptedFlow, created_at: new Date(row.createdAt).toISOString(), expires_at: new Date(row.expiresAt).toISOString(),
      });
      break;
    }
    case "authorization.get":
      result = await admin.rpc("store_get_customer_authorization", authorizationProofs!).select(authorizationColumns).maybeSingle();
      break;
    case "authorization.consume":
      result = await admin.rpc("store_consume_customer_authorization", authorizationProofs!);
      break;
    case "session.create": {
      const row = command.record;
      result = await admin.from("store_customer_sessions").insert({
        ...identity, session_hash: row.sessionHash, subject: row.subject, encrypted_tokens: row.encryptedTokens,
        created_at: new Date(row.createdAt).toISOString(), updated_at: new Date(row.createdAt).toISOString(),
        expires_at: new Date(row.expiresAt).toISOString(), access_expires_at: new Date(row.accessExpiresAt).toISOString(), revision: 0,
      });
      break;
    }
    case "session.get":
      result = await admin.rpc("store_get_customer_session", sessionProof!).select(sessionColumns).maybeSingle();
      break;
    case "session.rotate":
      result = await admin.rpc("store_rotate_customer_session", {
        ...sessionProof!, p_expected_revision: command.expectedRevision, p_encrypted_tokens: command.encryptedTokens,
        p_access_expires_at: new Date(command.accessExpiresAt).toISOString(),
      });
      break;
    case "session.revoke":
      result = await admin.rpc("store_revoke_customer_session", sessionProof!);
  }
  if (result.error) throw new CustomerAuthBackendError(result.error.code);
  let data: unknown = command.operation.endsWith(".create") ? true : result.data;
  if (command.operation === "authorization.get" && result.data) {
    const row = result.data;
    data = { stateHash: row.state_hash, browserBindingHash: row.browser_binding_hash, encryptedFlow: row.encrypted_flow,
      createdAt: Date.parse(row.created_at), expiresAt: Date.parse(row.expires_at) };
  }
  if (command.operation === "session.get" && result.data) {
    const row = result.data;
    data = { sessionHash: row.session_hash, subject: row.subject, encryptedTokens: row.encrypted_tokens,
      createdAt: Date.parse(row.created_at), expiresAt: Date.parse(row.expires_at), accessExpiresAt: Date.parse(row.access_expires_at), revision: row.revision };
  }
  const parsed = customerAuthResultSchema(command.operation, { data });
  if (!parsed) throw new CustomerAuthBackendError();
  return parsed;
}

const sameScope = (first: CustomerAuthScope, second: CustomerAuthScope) => first.shopId === second.shopId &&
  first.clientId === second.clientId && first.issuer === second.issuer && first.redirectUri === second.redirectUri;

/**
 * Server-only storage for encrypted buyer sign-in records in the shared RMT
 * database, pinned to one Shopify client. Unavailability must never look like
 * a missing buyer session, so every failure throws.
 */
export function createCustomerAuthBackend({ database, scope, now = Date.now }: {
  database: SupabaseClient;
  scope: CustomerAuthScope;
  now?: () => number;
}) {
  return async function execute<Sent extends CustomerAuthCommand>(command: Sent): Promise<CustomerAuthResults[Sent["operation"]]> {
    if (!customerAuthCommandSchema(command) || !sameScope(command.scope, scope)) throw new CustomerAuthBackendError();
    // Records are created fresh and live; a small clock tolerance covers server skew.
    const time = now();
    if (("record" in command && (command.record.createdAt > time + 5000 || command.record.expiresAt <= time ||
      ("accessExpiresAt" in command.record && command.record.accessExpiresAt <= time))) ||
      (command.operation === "session.rotate" && command.accessExpiresAt <= time)) throw new CustomerAuthBackendError();
    try {
      return (await executeStoreCustomerAuth(database, scope, command)).data as CustomerAuthResults[Sent["operation"]];
    } catch (error) {
      throw error instanceof CustomerAuthBackendError ? error : new CustomerAuthBackendError();
    }
  };
}

export type CustomerAuthBackend = ReturnType<typeof createCustomerAuthBackend>;
