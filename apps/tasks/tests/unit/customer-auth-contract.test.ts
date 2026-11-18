import { describe, expect, it } from "vitest";
import { customerAuthCommandSchema, customerAuthResultSchema, customerAuthScopeSchema } from "@ryanmeetup/reviews";

const scope = { shopId: "123", clientId: "client", issuer: "https://shopify.com/authentication/123", redirectUri: "https://store.test/api/reviews/auth/callback" };
const encrypted = `v1.test.${"a".repeat(16)}.${"b".repeat(48)}.${"c".repeat(22)}`;
const record = { sessionHash: "a".repeat(64), subject: "buyer", encryptedTokens: encrypted, createdAt: 1000, accessExpiresAt: 3601000, expiresAt: 86401000 };

describe("private customer auth contract", () => {
  it("binds scope to a canonical shop issuer and exact HTTPS callback", () => {
    expect(customerAuthScopeSchema(scope)).toEqual(scope);
    for (const extra of [{ issuer: "https://shopify.com/authentication/999" }, { redirectUri: "http://store.test/api/reviews/auth/callback" },
      { redirectUri: "https://store.test/api/reviews/auth/callback?next=external" }, { redirectUri: "https://user:pass@store.test/api/reviews/auth/callback" }, { secret: "never-accepted" }]) {
      expect(customerAuthScopeSchema({ ...scope, ...extra })).toBeNull();
    }
  });

  it("rejects plaintext tokens, caller-set revisions, extra privileges, and impossible timestamps", () => {
    expect(customerAuthCommandSchema({ operation: "session.create", scope, record })).not.toBeNull();
    for (const extra of [{ encryptedTokens: "private-plaintext-token" }, { revision: 100 }, { admin: true },
      { accessExpiresAt: Number.MAX_SAFE_INTEGER }, { expiresAt: record.createdAt + 31 * 86400_000 }, { sessionHash: "raw-browser-id" }]) {
      expect(customerAuthCommandSchema({ operation: "session.create", scope, record: { ...record, ...extra } })).toBeNull();
    }
    expect(customerAuthCommandSchema({ operation: "session.get", scope, sessionHash: record.sessionHash, record })).toBeNull();
    expect(customerAuthCommandSchema({ operation: "sql", scope, sql: "select * from profiles" })).toBeNull();
  });

  it("treats malformed transport results separately from a missing row or lost race", () => {
    expect(customerAuthResultSchema("session.get", { data: null })).toEqual({ data: null });
    expect(customerAuthResultSchema("session.rotate", { data: false })).toEqual({ data: false });
    expect(customerAuthResultSchema("session.create", { data: false })).toBeNull();
    expect(customerAuthResultSchema("session.get", { data: true })).toBeNull();
    expect(customerAuthResultSchema("session.get", { data: null, secret: "unexpected" })).toBeNull();
    expect(customerAuthResultSchema("session.get", { data: { ...record, revision: 0, tasks: [] } })).toBeNull();
    expect(customerAuthResultSchema("session.get", { data: { ...record, revision: 0 } })).toEqual({ data: { ...record, revision: 0 } });
  });
});
