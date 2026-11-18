import { expect } from "@playwright/test";
import { customerAuthCommandSchema } from "@ryanmeetup/reviews";
import type { CustomerAuthCommand, StoredCustomerAuthorization, StoredCustomerSession } from "@ryanmeetup/reviews";

const token = "t".repeat(43);

export function customerAuthBackendFixture() {
  const requests: CustomerAuthCommand[] = [];
  const flows = new Map<string, StoredCustomerAuthorization | null>();
  const sessions = new Map<string, StoredCustomerSession | null>();
  const fetcher: typeof fetch = async (input, init) => {
    expect(String(input)).toBe("https://backend.test/api/store/customer-auth");
    expect(init?.redirect).toBe("error");
    expect(init?.cache).toBe("no-store");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${token}`);
    const command = customerAuthCommandSchema(JSON.parse(String(init?.body)));
    if (!command) throw new Error("Invalid test command");
    requests.push(command);
    let data: unknown = null;
    switch (command.operation) {
      case "authorization.create":
        if (flows.has(command.record.stateHash)) return new Response("conflict", { status: 409 });
        flows.set(command.record.stateHash, command.record); data = true; break;
      case "authorization.get": {
        const row = flows.get(command.stateHash);
        data = row?.browserBindingHash === command.browserBindingHash ? row : null; break;
      }
      case "authorization.consume": {
        const row = flows.get(command.stateHash);
        data = row?.browserBindingHash === command.browserBindingHash;
        if (data) flows.set(command.stateHash, null); break;
      }
      case "session.create": sessions.set(command.record.sessionHash, { ...command.record, revision: 0 }); data = true; break;
      case "session.get": data = sessions.get(command.sessionHash) ?? null; break;
      case "session.revoke": data = Boolean(sessions.get(command.sessionHash)); sessions.set(command.sessionHash, null); break;
      case "session.rotate": {
        const row = sessions.get(command.sessionHash);
        data = row?.revision === command.expectedRevision;
        if (row && data) sessions.set(command.sessionHash, { ...row, revision: row.revision + 1, encryptedTokens: command.encryptedTokens, accessExpiresAt: command.accessExpiresAt });
      }
    }
    return Response.json({ data });
  };
  return { fetcher, requests, flows, sessions };
}
