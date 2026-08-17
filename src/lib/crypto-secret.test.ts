import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, tryDecryptSecret } from "./crypto";

describe("secret encryption (AES-256-GCM)", () => {
  it("round-trips a token", () => {
    const token = "ya29.a0AfB_byC-super-secret-refresh-token";
    const enc = encryptSecret(token);
    expect(enc).not.toContain(token); // ciphertext must not leak plaintext
    expect(enc.split(":")).toHaveLength(3); // iv:tag:data
    expect(decryptSecret(enc)).toBe(token);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("rejects tampered ciphertext", () => {
    const enc = encryptSecret("integrity");
    const [iv, tag, data] = enc.split(":");
    const flipped = data.slice(0, -1) + (data.endsWith("A") ? "B" : "A");
    expect(() => decryptSecret([iv, tag, flipped].join(":"))).toThrow();
    expect(tryDecryptSecret([iv, tag, flipped].join(":"))).toBeNull();
  });

  it("tryDecrypt returns null for junk instead of throwing", () => {
    expect(tryDecryptSecret("not-a-real-ciphertext")).toBeNull();
    expect(tryDecryptSecret(null)).toBeNull();
  });
});
