import { describe, expect, it } from "vitest";
import {
  normalizeDomainName,
  validateDomainInput,
  validateDomainName,
  validateExpirationDate,
  validateRenewalYears,
} from "./domain-validation";

describe("domain validation", () => {
  it("normalizes case, whitespace, and a trailing DNS root dot", () => {
    expect(normalizeDomainName("  Example.COM.  ")).toBe("example.com");
    expect(validateDomainName(" Example.COM. ")).toEqual({
      ok: true,
      value: "example.com",
    });
  });

  it.each([
    "https://example.com",
    "example",
    "-example.com",
    "example-.com",
    "exa mple.com",
    "example..com",
    "",
  ])("rejects invalid domain name %j", (value) => {
    expect(validateDomainName(value).ok).toBe(false);
  });

  it("rejects non-string input and labels longer than the DNS limit", () => {
    expect(validateDomainName(null).ok).toBe(false);
    expect(validateDomainName("a".repeat(64) + ".com").ok).toBe(false);
  });

  it("validates the complete API payload and strips unknown fields", () => {
    expect(
      validateDomainInput({
        domainName: "EXAMPLE.com.",
        expirationDate: "2028-02-29",
        unexpected: "ignored",
      }),
    ).toEqual({
      ok: true,
      value: { domainName: "example.com", expirationDate: "2028-02-29" },
    });
    expect(validateDomainInput([]).ok).toBe(false);
    expect(
      validateDomainInput({ domainName: "example.com", expirationDate: "2026-02-29" }).ok,
    ).toBe(false);
  });

  it("accepts real calendar dates and rejects impossible dates", () => {
    expect(validateExpirationDate("2028-02-29").ok).toBe(true);
    expect(validateExpirationDate("2027-02-29").ok).toBe(false);
    expect(validateExpirationDate("2027-13-01").ok).toBe(false);
  });
});

describe("renewal period validation", () => {
  it.each([1, 2, 5, 99])("accepts %i whole years", (years) => {
    expect(validateRenewalYears(years)).toEqual({ ok: true, value: years });
  });

  it.each([0, 100, 1.5, "2", null])("rejects invalid renewal period %j", (years) => {
    expect(validateRenewalYears(years).ok).toBe(false);
  });
});
