/** Private server-to-server contract. Never expose these records to a browser. */

export type CustomerAuthScope = {
  shopId: string;
  clientId: string;
  issuer: string;
  redirectUri: string;
};

export type StoredCustomerAuthorization = {
  stateHash: string;
  browserBindingHash: string;
  encryptedFlow: string;
  createdAt: number;
  expiresAt: number;
};

export type StoredCustomerSession = {
  sessionHash: string;
  subject: string;
  encryptedTokens: string;
  createdAt: number;
  expiresAt: number;
  accessExpiresAt: number;
  revision: number;
};

type AuthorizationProofs = Pick<StoredCustomerAuthorization, "stateHash" | "browserBindingHash">;
type SessionProof = Pick<StoredCustomerSession, "sessionHash">;
type Commands =
  | { operation: "authorization.create"; record: StoredCustomerAuthorization }
  | ({ operation: "authorization.get" | "authorization.consume" } & AuthorizationProofs)
  | { operation: "session.create"; record: Omit<StoredCustomerSession, "revision"> }
  | ({ operation: "session.get" | "session.revoke" } & SessionProof)
  | ({ operation: "session.rotate"; expectedRevision: number; encryptedTokens: string; accessExpiresAt: number } & SessionProof);

export type CustomerAuthCommand = Commands & { scope: CustomerAuthScope };
export type CustomerAuthOperation = CustomerAuthCommand["operation"];
export type CustomerAuthResults = {
  "authorization.create": true;
  "authorization.get": StoredCustomerAuthorization | null;
  "authorization.consume": boolean;
  "session.create": true;
  "session.get": StoredCustomerSession | null;
  "session.rotate": boolean;
  "session.revoke": boolean;
};

function object(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.keys(value).every((key) => keys.includes(key)) ? value as Record<string, unknown> : null;
}

const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const timestamp = (value: unknown): value is number => integer(value) && value <= 253402300799999;
const envelope = (value: unknown): value is string => typeof value === "string" && value.length <= 65536 &&
  /^v1\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/.test(value);
const subject = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);

export function customerAuthScopeSchema(value: unknown): CustomerAuthScope | null {
  const scope = object(value, ["shopId", "clientId", "issuer", "redirectUri"]);
  if (!scope || typeof scope.shopId !== "string" || !/^[1-9][0-9]*$/.test(scope.shopId) ||
    typeof scope.clientId !== "string" || !/^[^\s:\u0000-\u001f\u007f]{1,200}$/u.test(scope.clientId) ||
    scope.issuer !== `https://shopify.com/authentication/${scope.shopId}` ||
    typeof scope.redirectUri !== "string" || /[\s\\\u0000-\u001f\u007f]/u.test(scope.redirectUri)) return null;
  try {
    const url = new URL(scope.redirectUri);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      url.pathname !== "/api/reviews/auth/callback" || url.href !== scope.redirectUri) return null;
  } catch { return null; }
  return scope as CustomerAuthScope;
}

function authorizationSchema(value: unknown): StoredCustomerAuthorization | null {
  const record = object(value, ["stateHash", "browserBindingHash", "encryptedFlow", "createdAt", "expiresAt"]);
  return record && hash(record.stateHash) && hash(record.browserBindingHash) && envelope(record.encryptedFlow) &&
    timestamp(record.createdAt) && timestamp(record.expiresAt) && record.expiresAt === record.createdAt + 600_000
    ? record as StoredCustomerAuthorization : null;
}

function sessionSchema(value: unknown, withRevision: boolean): StoredCustomerSession | Omit<StoredCustomerSession, "revision"> | null {
  const record = object(value, ["sessionHash", "subject", "encryptedTokens", "createdAt", "expiresAt", "accessExpiresAt", ...(withRevision ? ["revision"] : [])]);
  return record && hash(record.sessionHash) && subject(record.subject) && envelope(record.encryptedTokens) &&
    timestamp(record.createdAt) && timestamp(record.expiresAt) && timestamp(record.accessExpiresAt) &&
    record.expiresAt > record.createdAt && record.expiresAt <= record.createdAt + 30 * 86400_000 &&
    record.accessExpiresAt > record.createdAt && (!withRevision || integer(record.revision))
    ? record as StoredCustomerSession : null;
}

export function customerAuthCommandSchema(value: unknown): CustomerAuthCommand | null {
  const command = object(value, ["operation", "scope", "record", "stateHash", "browserBindingHash", "sessionHash", "expectedRevision", "encryptedTokens", "accessExpiresAt"]);
  if (!command || !customerAuthScopeSchema(command.scope)) return null;
  const exact = (keys: string[]) => object(value, ["operation", "scope", ...keys]);
  switch (command.operation) {
    case "authorization.create":
      if (!exact(["record"]) || !authorizationSchema(command.record)) return null;
      break;
    case "authorization.get":
    case "authorization.consume":
      if (!exact(["stateHash", "browserBindingHash"]) || !hash(command.stateHash) || !hash(command.browserBindingHash)) return null;
      break;
    case "session.create":
      if (!exact(["record"]) || !sessionSchema(command.record, false)) return null;
      break;
    case "session.get":
    case "session.revoke":
      if (!exact(["sessionHash"]) || !hash(command.sessionHash)) return null;
      break;
    case "session.rotate":
      if (!exact(["sessionHash", "expectedRevision", "encryptedTokens", "accessExpiresAt"]) ||
        !hash(command.sessionHash) || !integer(command.expectedRevision) || !envelope(command.encryptedTokens) || !timestamp(command.accessExpiresAt)) return null;
      break;
    default: return null;
  }
  return command as CustomerAuthCommand;
}

/** An invalid transport payload stays distinct from a legitimate missing row. */
export function customerAuthResultSchema<Operation extends CustomerAuthOperation>(operation: Operation, value: unknown): { data: CustomerAuthResults[Operation] } | null {
  const result = object(value, ["data"]);
  if (!result || !("data" in result)) return null;
  const data = result.data;
  const valid = operation === "authorization.get" ? data === null || authorizationSchema(data) !== null
    : operation === "session.get" ? data === null || sessionSchema(data, true) !== null
    : operation.endsWith(".create") ? data === true : typeof data === "boolean";
  return valid ? { data: data as CustomerAuthResults[Operation] } : null;
}
