import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
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
