import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { StoredCustomerAuthorization, StoredCustomerSession } from "@ryanmeetup/reviews";

/** A loopback address no test listens on: every request to it is answered by a fetch fake. */
export const fakeSupabaseUrl = "http://127.0.0.1:54398";
export const fakeSupabaseKey = "synthetic-supabase-secret";
export const fakeSupabaseEnvironment = { SUPABASE_URL: fakeSupabaseUrl, SUPABASE_SECRET_KEY: fakeSupabaseKey };

/** One Supabase REST call the store made: an insert into a table, or an RPC with its arguments. */
export type SupabaseCall = { name: string; args: Record<string, unknown> };

/** Reads a supabase-js request to the fake project, or null for any other URL. */
export function supabaseCall(input: RequestInfo | URL, init?: RequestInit): SupabaseCall | null {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== fakeSupabaseUrl) return null;
  expect(new Headers(init?.headers).get("apikey")).toBe(fakeSupabaseKey);
  const name = url.pathname.replace(/^\/rest\/v1\/(?:rpc\/)?/, "");
  return { name, args: init?.body ? JSON.parse(String(init.body)) : {} };
}

const operations: Record<string, string> = {
  store_customer_authorizations: "authorization.create",
  store_get_customer_authorization: "authorization.get",
  store_consume_customer_authorization: "authorization.consume",
  store_customer_sessions: "session.create",
  store_get_customer_session: "session.get",
  store_rotate_customer_session: "session.rotate",
  store_revoke_customer_session: "session.revoke",
};

const iso = (value: number) => new Date(value).toISOString();

/**
 * Synthetic sign-in storage behind the fake Supabase project. It keeps records
 * in the store's own shape and answers in the database's row shape.
 */
export function customerAuthBackendFixture() {
  const requests: ({ operation: string } & Record<string, unknown>)[] = [];
  const flows = new Map<string, StoredCustomerAuthorization | null>();
  const sessions = new Map<string, StoredCustomerSession | null>();
  const rows = (data: unknown) => Response.json(data);
  const fetcher: typeof fetch = async (input, init) => {
    const call = supabaseCall(input, init);
    const operation = call && operations[call.name];
    if (!call || !operation) throw new Error(`Unexpected test request: ${String(input)}`);
    const args = call.args;
    requests.push({ operation, ...args });
    switch (operation) {
      case "authorization.create": {
        const hash = String(args.state_hash);
        if (flows.has(hash)) return Response.json({ code: "23505", message: "duplicate key" }, { status: 409 });
        flows.set(hash, { stateHash: hash, browserBindingHash: String(args.browser_binding_hash), encryptedFlow: String(args.encrypted_flow),
          createdAt: Date.parse(String(args.created_at)), expiresAt: Date.parse(String(args.expires_at)) });
        return new Response(null, { status: 201 });
      }
      case "authorization.get": {
        const row = flows.get(String(args.p_state_hash));
        return rows(row && row.browserBindingHash === args.p_browser_binding_hash ? [{ state_hash: row.stateHash, browser_binding_hash: row.browserBindingHash,
          encrypted_flow: row.encryptedFlow, created_at: iso(row.createdAt), expires_at: iso(row.expiresAt) }] : []);
      }
      case "authorization.consume": {
        const row = flows.get(String(args.p_state_hash));
        const consumed = row?.browserBindingHash === args.p_browser_binding_hash;
        if (consumed) flows.set(String(args.p_state_hash), null);
        return rows(consumed);
      }
      case "session.create": {
        const hash = String(args.session_hash);
        sessions.set(hash, { sessionHash: hash, subject: String(args.subject), encryptedTokens: String(args.encrypted_tokens),
          createdAt: Date.parse(String(args.created_at)), expiresAt: Date.parse(String(args.expires_at)),
          accessExpiresAt: Date.parse(String(args.access_expires_at)), revision: 0 });
        return new Response(null, { status: 201 });
      }
      case "session.get": {
        const row = sessions.get(String(args.p_session_hash));
        return rows(row ? [{ session_hash: row.sessionHash, subject: row.subject, encrypted_tokens: row.encryptedTokens, created_at: iso(row.createdAt),
          expires_at: iso(row.expiresAt), access_expires_at: iso(row.accessExpiresAt), revision: row.revision }] : []);
      }
      case "session.revoke": {
        const hash = String(args.p_session_hash);
        const existed = Boolean(sessions.get(hash));
        sessions.set(hash, null);
        return rows(existed);
      }
      default: {
        const row = sessions.get(String(args.p_session_hash));
        const rotated = row?.revision === args.p_expected_revision;
        if (row && rotated) sessions.set(row.sessionHash, { ...row, revision: row.revision + 1, encryptedTokens: String(args.p_encrypted_tokens),
          accessExpiresAt: Date.parse(String(args.p_access_expires_at)) });
        return rows(rotated);
      }
    }
  };
  return { fetcher, requests, flows, sessions };
}

/** A real supabase-js client whose requests all go to `fetcher`. */
export function fakeSupabase(fetcher: typeof fetch) {
  return createClient(fakeSupabaseUrl, fakeSupabaseKey, { global: { fetch: fetcher }, auth: { persistSession: false, autoRefreshToken: false } });
}
