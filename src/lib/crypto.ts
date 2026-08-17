import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { config } from "./config";

/** Generate a URL-safe random token (raw, secret — only shown once). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Hash a token for at-rest storage. We never store raw session/reset tokens. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** HMAC-sign a value so tampering is detectable (used for signed cookies). */
export function sign(value: string): string {
  const sig = createHmac("sha256", config.sessionSecret).update(value).digest("base64url");
  return `${value}.${sig}`;
}

/** Verify and unwrap a signed value. Returns null if signature is invalid. */
export function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = createHmac("sha256", config.sessionSecret).update(value).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? value : null;
}

// ---------------------------------------------------------------------------
// Symmetric encryption for secrets at rest (OAuth provider tokens, etc.)
//
// Provider tokens must never touch disk in plaintext and must never reach the
// frontend. We use AES-256-GCM with a random 96-bit IV per message and store
// `iv:tag:ciphertext` (all base64url). The key is derived from a dedicated
// ENCRYPTION_KEY when present, falling back to the session secret so local dev
// works without extra setup. Rotating ENCRYPTION_KEY invalidates old ciphertext
// by design — callers treat decrypt failures as "reconnect required".
// ---------------------------------------------------------------------------

let cachedKey: Buffer | null = null;
function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = config.encryptionKey || config.sessionSecret || "insecure-dev-encryption-key";
  // scrypt stretches whatever secret we have into a fixed 32-byte AES key.
  cachedKey = scryptSync(secret, "done.token.v1", 32);
  return cachedKey;
}

/** Encrypt a UTF-8 string. Returns `iv:tag:ciphertext` (base64url). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(":");
}

/** Decrypt a value produced by encryptSecret. Throws on tamper/wrong key. */
export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("Malformed ciphertext.");
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

/** Safe variant: returns null instead of throwing (e.g. after key rotation). */
export function tryDecryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}
