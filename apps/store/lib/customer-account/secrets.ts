import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { customerAccountIssuer, publicHttpsUrl } from "./config";
import { customerAuthorizationLifetime } from "./authorization";
import { isShopId } from "./formats";

type CommonContext = {
  recordHash: string;
  shopId: string;
  clientId: string;
  issuer: string;
  createdAt: number;
  expiresAt: number;
};

export type CustomerAccountSecretContext = CommonContext & ({
  kind: "authorization";
  browserBindingHash: string;
  redirectUri: string;
} | {
  kind: "session";
  subject: string;
  accessExpiresAt: number;
  revision: number;
});

export type CustomerAccountEncryptionKeys = {
  activeKeyId: string;
  keys: ReadonlyMap<string, Buffer>;
};

const maxPlaintextBytes = 32 * 1024;
const keyIdPattern = /^[a-zA-Z0-9_-]{1,32}$/;
const hashPattern = /^[a-f0-9]{64}$/;

function base64url(value: unknown): Buffer | null {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]+$/.test(value)) return null;
  const buffer = Buffer.from(value, "base64url");
  return buffer.toString("base64url") === value ? buffer : null;
}

/** Server-owned keyring; diagnostics never include key material. */
export function getCustomerAccountEncryptionKeys(env: Readonly<Record<string, string | undefined>> = process.env): {
  status: "configured";
  keyring: CustomerAccountEncryptionKeys;
} | { status: "unavailable" } {
  const activeKeyId = env.STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEY_ID ?? "";
  const encoded = env.STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEYS ?? "";
  if (!keyIdPattern.test(activeKeyId) || !encoded || encoded.length > 4096) return { status: "unavailable" };
  try {
    const parsed: unknown = JSON.parse(encoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { status: "unavailable" };
    const entries = Object.entries(parsed);
    if (!entries.length || entries.length > 5) return { status: "unavailable" };
    const keys = new Map<string, Buffer>();
    for (const [id, value] of entries) {
      const key = base64url(value);
      if (!keyIdPattern.test(id) || key?.length !== 32) return { status: "unavailable" };
      keys.set(id, key);
    }
    return keys.has(activeKeyId) ? { status: "configured", keyring: { activeKeyId, keys } } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

function associatedData(context: CustomerAccountSecretContext): Buffer {
  const timestamp = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (!hashPattern.test(context.recordHash) || !isShopId(context.shopId) ||
    !context.clientId || context.clientId.length > 200 || context.issuer !== customerAccountIssuer(context.shopId) ||
    !timestamp(context.createdAt) || !timestamp(context.expiresAt) || context.expiresAt <= context.createdAt) throw new Error("Invalid secret context");
  const common = ["ryanmeetup:store:customer-account:v1", context.kind, context.recordHash, context.shopId, context.clientId, context.issuer, context.createdAt, context.expiresAt];
  if (context.kind === "authorization") {
    if (!hashPattern.test(context.browserBindingHash) || !publicHttpsUrl(context.redirectUri) || context.expiresAt !== context.createdAt + customerAuthorizationLifetime * 1000) throw new Error("Invalid authorization context");
    return Buffer.from(JSON.stringify([...common, context.browserBindingHash, context.redirectUri]));
  }
  if (context.kind !== "session" || !context.subject || context.subject.length > 512 ||
    !timestamp(context.accessExpiresAt) || context.accessExpiresAt <= context.createdAt || !timestamp(context.revision)) throw new Error("Invalid session context");
  return Buffer.from(JSON.stringify([...common, context.subject, context.accessExpiresAt, context.revision]));
}

/** AES-256-GCM with a fresh IV, bound to the complete immutable row context. */
export function sealCustomerAccountSecret(plaintext: string, context: CustomerAccountSecretContext, keyring: CustomerAccountEncryptionKeys): string {
  try {
    if (typeof plaintext !== "string" || !plaintext.length || plaintext.length > maxPlaintextBytes) throw new Error("Invalid payload");
    const payload = Buffer.from(plaintext);
    const key = keyring.keys.get(keyring.activeKeyId);
    if (payload.length > maxPlaintextBytes || !key || key.length !== 32 || !keyIdPattern.test(keyring.activeKeyId)) throw new Error("Invalid encryption configuration");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(associatedData(context));
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    return ["v1", keyring.activeKeyId, iv.toString("base64url"), encrypted.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
  } catch {
    throw new Error("Customer account secrets could not be sealed.");
  }
}

/** Invalid, moved, tampered, or retired-key records never yield usable tokens. */
export function openCustomerAccountSecret(envelope: string, context: CustomerAccountSecretContext, keyring: CustomerAccountEncryptionKeys): string | null {
  try {
    if (typeof envelope !== "string" || envelope.length > 65536) return null;
    const [version, keyId, encodedIv, encodedBody, encodedTag, extra] = envelope.split(".");
    if (version !== "v1" || !keyIdPattern.test(keyId ?? "") || extra !== undefined) return null;
    const key = keyring.keys.get(keyId);
    const iv = base64url(encodedIv);
    const body = base64url(encodedBody);
    const tag = base64url(encodedTag);
    if (key?.length !== 32 || iv?.length !== 12 || tag?.length !== 16 || !body || !body.length || body.length > maxPlaintextBytes) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(associatedData(context));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
