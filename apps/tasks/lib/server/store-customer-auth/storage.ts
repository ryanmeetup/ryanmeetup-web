import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { customerAuthResultSchema } from "@ryanmeetup/reviews";
import type { CustomerAuthCommand, CustomerAuthScope } from "@ryanmeetup/reviews";

const authorizationColumns = "state_hash,browser_binding_hash,encrypted_flow,created_at,expires_at";
const sessionColumns = "session_hash,subject,encrypted_tokens,created_at,expires_at,access_expires_at,revision";

export class CustomerAuthDatabaseError extends Error {
  constructor(readonly code?: string) { super("Store customer authentication storage failed."); }
}

/** Fixed operations only: no caller-selected table, columns, RPC, or scope. */
export async function executeStoreCustomerAuth(admin: SupabaseClient, scope: CustomerAuthScope, command: CustomerAuthCommand) {
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
  if (result.error) throw new CustomerAuthDatabaseError(result.error.code);
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
  if (!parsed) throw new CustomerAuthDatabaseError();
  return parsed;
}
