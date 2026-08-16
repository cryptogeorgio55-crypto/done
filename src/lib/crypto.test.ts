import { describe, it, expect } from "vitest";
import { sign, unsign, hashToken, generateToken } from "./crypto";

describe("signed values", () => {
  it("round-trips a signed value", () => {
    const signed = sign("session-abc");
    expect(unsign(signed)).toBe("session-abc");
  });

  it("rejects a tampered value", () => {
    const signed = sign("session-abc");
    const tampered = signed.replace("session-abc", "session-xyz");
    expect(unsign(tampered)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(unsign("not-a-signed-value")).toBeNull();
  });
});

describe("tokens", () => {
  it("hashes deterministically and differs per token", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(b));
  });
});
