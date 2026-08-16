import { describe, it, expect } from "vitest";
import { assertWithinLimit } from "./entitlements";
import { EntitlementError } from "./errors";

describe("assertWithinLimit", () => {
  it("allows usage below the limit", () => {
    expect(() => assertWithinLimit(30, 0, "AI generations")).not.toThrow();
    expect(() => assertWithinLimit(30, 29, "AI generations")).not.toThrow();
  });

  it("blocks when at or above the limit", () => {
    expect(() => assertWithinLimit(30, 30, "AI generations")).toThrow(EntitlementError);
    expect(() => assertWithinLimit(30, 31, "AI generations")).toThrow(EntitlementError);
  });

  it("treats null as unlimited", () => {
    expect(() => assertWithinLimit(null, 10_000, "AI generations")).not.toThrow();
  });
});
