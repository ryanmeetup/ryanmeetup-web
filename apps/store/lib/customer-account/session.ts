import type { CustomerAuthScope } from "@ryanmeetup/reviews";
import { customerAuthorizationProofHash } from "./authorization";
import type { CustomerAccountSession, CustomerAccountStorage } from "./storage";
import { CustomerAccountRefreshRejected } from "./tokens";
import type { CustomerAccountTokenClient } from "./tokens";

/** Private server result: do not serialize the session or its tokens to a browser. */
export type CustomerSessionResult =
  | { status: "authenticated"; session: CustomerAccountSession }
  | { status: "sign_in_required" }
  | { status: "unavailable" };

type Renewal = "finished" | "rejected" | "unavailable";
// Pending work only, never a session cache. Include backend and complete client
// scope so separate test backends or Shopify clients cannot share work.
const renewals = new Map<string, Promise<Renewal>>();
const renewalWindow = 30_000;

function sameSession(first: CustomerAccountSession, second: CustomerAccountSession) {
  return first.sessionHash === second.sessionHash && first.subject === second.subject &&
    first.createdAt === second.createdAt && first.expiresAt === second.expiresAt && second.revision >= first.revision;
}

export function createCustomerSessionLoader({ storage, refresh, scope, backendOrigin, now = Date.now }: {
  storage: Pick<CustomerAccountStorage, "loadSession" | "rotateSession">;
  refresh: CustomerAccountTokenClient["refresh"];
  scope: CustomerAuthScope;
  backendOrigin: string;
  now?: () => number;
}) {
  async function renew(id: string, previous: CustomerAccountSession): Promise<Renewal> {
    try {
      // Recheck after joining the refresh path: another request may already
      // have renewed or revoked the record since this caller's first read.
      const latest = await storage.loadSession(id);
      if (!latest) return "finished";
      if (!sameSession(previous, latest)) return "unavailable";
      if (latest.revision > previous.revision || latest.accessExpiresAt > now() + renewalWindow || latest.expiresAt <= now()) return "finished";
      const renewed = await refresh(latest, now());
      if (renewed.accessExpiresAt <= now()) return "unavailable";
      if (latest.expiresAt <= now()) return "finished";
      // A lost CAS or uncertain response is resolved only by reading storage.
      // Never return this newly issued token directly or retry an old refresh.
      await storage.rotateSession(latest, renewed.tokens, renewed.accessExpiresAt);
      return "finished";
    } catch (error) {
      return error instanceof CustomerAccountRefreshRejected ? "rejected" : "unavailable";
    }
  }

  return async function load(id: unknown): Promise<CustomerSessionResult> {
    const sessionHash = customerAuthorizationProofHash(id);
    if (!sessionHash || typeof id !== "string") return { status: "sign_in_required" };
    try {
      const session = await storage.loadSession(id);
      if (!session || session.expiresAt <= now() || session.createdAt > now()) return { status: "sign_in_required" };
      if (session.sessionHash !== sessionHash) return { status: "unavailable" };
      if (session.accessExpiresAt > now() + renewalWindow) return { status: "authenticated", session };
      const key = JSON.stringify([backendOrigin, scope.shopId, scope.clientId, scope.issuer, scope.redirectUri, sessionHash]);
      let work = renewals.get(key);
      if (!work) {
        work = renew(id, session);
        renewals.set(key, work);
      }
      let outcome: Renewal;
      try { outcome = await work; }
      finally { if (renewals.get(key) === work) renewals.delete(key); }

      // Every waiter reads independently, including after provider errors.
      // Another process may have won, or logout may have erased the envelope.
      const current = await storage.loadSession(id);
      if (!current || current.expiresAt <= now() || current.createdAt > now()) return { status: "sign_in_required" };
      if (!sameSession(session, current)) return { status: "unavailable" };
      if (current.revision > session.revision && current.accessExpiresAt > now()) return { status: "authenticated", session: current };
      return { status: outcome === "rejected" && current.revision === session.revision ? "sign_in_required" : "unavailable" };
    } catch { return { status: "unavailable" }; }
  };
}
