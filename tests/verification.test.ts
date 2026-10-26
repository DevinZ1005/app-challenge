import { describe, expect, it } from "vitest";
import {
  verificationFreshness,
  providerVerificationStatus,
  providerVerificationDate,
} from "../src/lib/verification";
import { demoProviders } from "../src/lib/data";

describe("verification freshness", () => {
  const now = new Date("2026-10-25T12:00:00Z");

  it("does not treat missing, invalid, or future evidence as confirmation", () => {
    for (const date of [null, "", "invalid", "2026-10-26T12:00:00Z"])
      expect(verificationFreshness(date, now)).toBe("unconfirmed");
  });

  it("requires a recheck only after the existing 30-day window", () => {
    expect(verificationFreshness("2026-09-25T12:00:00Z", now)).toBe("recent");
    expect(verificationFreshness("2026-09-25T11:59:59Z", now)).toBe("outdated");
    expect(verificationFreshness(now.toISOString(), now)).toBe("recent");
  });

  it("does not confirm evidence when the comparison clock is invalid", () => {
    expect(verificationFreshness(now.toISOString(), new Date("invalid"))).toBe(
      "unconfirmed",
    );
  });

  it("keeps partial checks separate and uses the oldest core check", () => {
    const p = { ...structuredClone(demoProviders[0]), demo: false };
    const check = {
      checkedAt: now.toISOString(),
      method: "official_source" as const,
      sourceUrl: "https://example.test/evidence",
    };
    p.verification = { phone: check };
    expect(providerVerificationStatus(p, now)).toBe("unconfirmed");
    p.verification.hours = check;
    expect(providerVerificationStatus(p, now)).toBe("partial");
    expect(providerVerificationDate(p)).toBeNull();
    p.verification.offerings = check;
    p.verification.eligibility = {
      ...check,
      checkedAt: "2026-09-01T12:00:00Z",
    };
    expect(providerVerificationStatus(p, now)).toBe("outdated");
    expect(providerVerificationDate(p)).toBe("2026-09-01T12:00:00Z");
    p.verification.eligibility = check;
    expect(providerVerificationStatus(p, now)).toBe("recent");
    p.demo = true;
    expect(providerVerificationStatus(p, now)).toBe("unconfirmed");
    expect(providerVerificationDate(p)).toBeNull();
  });
});
