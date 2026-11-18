import { randomBytes } from "node:crypto";
import type { CustomerAuthScope, StoredCustomerAuthorization, StoredCustomerSession } from "@ryanmeetup/reviews";
import { customerAccountIssuer } from "./config";
import type { CustomerAccountConfig } from "./config";
import { customerAuthorizationProofHash, reviewReturnPath } from "./authorization";
import type { CustomerAuthorizationAttempt } from "./authorization";
import { createCustomerAuthBackend, CustomerAuthBackendError } from "./backend";
import { openCustomerAccountSecret, sealCustomerAccountSecret } from "./secrets";
import type { CustomerAccountEncryptionKeys, CustomerAccountSecretContext } from "./secrets";

export type CustomerAccountTokens = { accessToken: string; refreshToken: string; idToken: string };
export type CustomerAccountSession = Omit<StoredCustomerSession, "encryptedTokens"> & { tokens: CustomerAccountTokens };

export function sameCustomerAccountSession(first: CustomerAccountSession, second: CustomerAccountSession) {
  return first.sessionHash === second.sessionHash && first.subject === second.subject &&
    first.createdAt === second.createdAt && first.expiresAt === second.expiresAt && second.revision >= first.revision;
}

function privateObject(value: unknown, keys: string[]): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key))
    ? value as Record<string, unknown> : null;
}

function parsePrivateJson(value: string | null): unknown {
  try { return value === null ? null : JSON.parse(value); } catch { return null; }
}

function validTokens(value: unknown): value is CustomerAccountTokens {
  const tokens = privateObject(value, ["accessToken", "refreshToken", "idToken"]);
  return Boolean(tokens && [tokens.accessToken, tokens.refreshToken, tokens.idToken].every((token) =>
    typeof token === "string" && token.length > 0 && token.length <= 16384 && /^[\x21-\x7e]+$/u.test(token)));
}

export function createCustomerAccountStorage({ config, keyring, backend }: {
  config: CustomerAccountConfig;
  keyring: CustomerAccountEncryptionKeys;
  backend: ReturnType<typeof createCustomerAuthBackend>;
}) {
  const scope: CustomerAuthScope = { shopId: config.shopId, clientId: config.clientId, issuer: customerAccountIssuer(config.shopId), redirectUri: config.redirectUri };
  const flowContext = (row: StoredCustomerAuthorization): CustomerAccountSecretContext => ({
    kind: "authorization", ...scope, recordHash: row.stateHash, browserBindingHash: row.browserBindingHash,
    createdAt: row.createdAt, expiresAt: row.expiresAt,
  });
  const sessionContext = (row: Omit<StoredCustomerSession, "encryptedTokens">): CustomerAccountSecretContext => ({
    kind: "session", ...scope, recordHash: row.sessionHash, subject: row.subject,
    createdAt: row.createdAt, expiresAt: row.expiresAt, accessExpiresAt: row.accessExpiresAt, revision: row.revision,
  });

  async function loadSessionByHash(sessionHash: unknown): Promise<CustomerAccountSession | null> {
    if (typeof sessionHash !== "string" || !/^[a-f0-9]{64}$/.test(sessionHash)) return null;
    const row = await backend({ operation: "session.get", scope, sessionHash });
    if (!row || row.sessionHash !== sessionHash || row.createdAt > Date.now() || row.expiresAt <= Date.now()) return null;
    const tokens = parsePrivateJson(openCustomerAccountSecret(row.encryptedTokens, sessionContext(row), keyring));
    if (!validTokens(tokens)) return null;
    return { sessionHash: row.sessionHash, subject: row.subject, createdAt: row.createdAt, expiresAt: row.expiresAt,
      accessExpiresAt: row.accessExpiresAt, revision: row.revision, tokens };
  }

  return {
    async saveAuthorization(attempt: CustomerAuthorizationAttempt) {
      if (attempt.shopId !== scope.shopId || attempt.clientId !== scope.clientId || attempt.issuer !== scope.issuer ||
        attempt.redirectUri !== scope.redirectUri) throw new CustomerAuthBackendError();
      const row = { stateHash: attempt.stateHash, browserBindingHash: attempt.browserBindingHash, createdAt: attempt.createdAt, expiresAt: attempt.expiresAt };
      const encryptedFlow = sealCustomerAccountSecret(JSON.stringify({ nonce: attempt.nonce, codeVerifier: attempt.codeVerifier, returnPath: attempt.returnPath }),
        flowContext({ ...row, encryptedFlow: "" }), keyring);
      await backend({ operation: "authorization.create", scope, record: { ...row, encryptedFlow } });
    },

    async loadAuthorization(state: unknown, browserBinding: unknown): Promise<CustomerAuthorizationAttempt | null> {
      const stateHash = customerAuthorizationProofHash(state);
      const browserBindingHash = customerAuthorizationProofHash(browserBinding);
      if (!stateHash || !browserBindingHash) return null;
      const row = await backend({ operation: "authorization.get", scope, stateHash, browserBindingHash });
      if (!row || row.stateHash !== stateHash || row.browserBindingHash !== browserBindingHash || row.createdAt > Date.now() || row.expiresAt <= Date.now()) return null;
      const flow = privateObject(parsePrivateJson(openCustomerAccountSecret(row.encryptedFlow, flowContext(row), keyring)), ["nonce", "codeVerifier", "returnPath"]);
      if (!flow || typeof flow.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(flow.nonce) ||
        typeof flow.codeVerifier !== "string" || !/^[A-Za-z0-9_-]{64}$/.test(flow.codeVerifier) ||
        typeof flow.returnPath !== "string" || reviewReturnPath(flow.returnPath) !== flow.returnPath) return null;
      return { ...scope, stateHash, browserBindingHash, createdAt: row.createdAt, expiresAt: row.expiresAt,
        nonce: flow.nonce, codeVerifier: flow.codeVerifier, returnPath: flow.returnPath };
    },

    async consumeAuthorization(attempt: CustomerAuthorizationAttempt) {
      if (attempt.shopId !== scope.shopId || attempt.clientId !== scope.clientId || attempt.issuer !== scope.issuer ||
        attempt.redirectUri !== scope.redirectUri) throw new CustomerAuthBackendError();
      return backend({ operation: "authorization.consume", scope, stateHash: attempt.stateHash, browserBindingHash: attempt.browserBindingHash });
    },

    async createSession({ subject, tokens, accessExpiresAt, expiresAt, now = Date.now() }: {
      subject: string; tokens: CustomerAccountTokens; accessExpiresAt: number; expiresAt: number; now?: number;
    }) {
      if (!validTokens(tokens)) throw new CustomerAuthBackendError();
      const id = randomBytes(32).toString("base64url");
      const row = { sessionHash: customerAuthorizationProofHash(id)!, subject, createdAt: now, expiresAt, accessExpiresAt };
      const encryptedTokens = sealCustomerAccountSecret(JSON.stringify(tokens), sessionContext({ ...row, revision: 0 }), keyring);
      await backend({ operation: "session.create", scope, record: { ...row, encryptedTokens } });
      return { id, session: { ...row, revision: 0, tokens } satisfies CustomerAccountSession };
    },

    async loadSession(id: unknown): Promise<CustomerAccountSession | null> {
      const sessionHash = customerAuthorizationProofHash(id);
      return sessionHash ? loadSessionByHash(sessionHash) : null;
    },

    // Server-only continuation of an already authenticated session. This is
    // never accepted as a browser sign-in credential or exposed in a route.
    loadSessionByHash,

    async rotateSession(session: CustomerAccountSession, tokens: CustomerAccountTokens, accessExpiresAt: number) {
      if (!validTokens(tokens)) throw new CustomerAuthBackendError();
      const encryptedTokens = sealCustomerAccountSecret(JSON.stringify(tokens), sessionContext({ ...session, revision: session.revision + 1, accessExpiresAt }), keyring);
      return backend({ operation: "session.rotate", scope, sessionHash: session.sessionHash, expectedRevision: session.revision, encryptedTokens, accessExpiresAt });
    },

    async revokeSession(id: unknown) {
      const sessionHash = customerAuthorizationProofHash(id);
      return sessionHash ? backend({ operation: "session.revoke", scope, sessionHash }) : false;
    },
  };
}

export type CustomerAccountStorage = ReturnType<typeof createCustomerAccountStorage>;
