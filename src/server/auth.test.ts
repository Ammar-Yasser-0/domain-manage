import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSameOrigin,
  clearSessionCookie,
  createSessionToken,
  getAuthConfiguration,
  getSessionCookieName,
  sessionCookie,
  verifySessionToken,
} from "./auth";

const sessionSecret = randomBytes(32);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signed DomainFlow sessions", () => {
  it("accepts a valid seven-day session", () => {
    const now = Date.UTC(2026, 9, 27, 12);
    const token = createSessionToken(sessionSecret, now);

    expect(verifySessionToken(token, sessionSecret, now)).toBe(true);
    expect(verifySessionToken(token, sessionSecret, now + 6 * 24 * 60 * 60 * 1000)).toBe(true);
  });

  it("rejects an expired session", () => {
    const now = Date.UTC(2026, 9, 27, 12);
    const token = createSessionToken(sessionSecret, now);

    expect(
      verifySessionToken(token, sessionSecret, now + 7 * 24 * 60 * 60 * 1000),
    ).toBe(false);
  });

  it("rejects tampered tokens and signatures from another secret", () => {
    const token = createSessionToken(sessionSecret);
    const [payload, signature] = token.split(".");
    const changedToken = payload + "." + (signature[0] === "A" ? "B" : "A") + signature.slice(1);

    expect(verifySessionToken(changedToken, sessionSecret)).toBe(false);
    expect(verifySessionToken(token, randomBytes(32))).toBe(false);
    expect(verifySessionToken("not.a.valid.token", sessionSecret)).toBe(false);
  });

  it("fails closed when either server authentication secret is missing or invalid", () => {
    vi.stubEnv("APP_PASSWORD_HASH", "");
    vi.stubEnv("SESSION_SECRET", sessionSecret.toString("base64url"));

    expect(() => getAuthConfiguration()).toThrowError(
      expect.objectContaining({ status: 503, code: "AUTH_NOT_CONFIGURED" }),
    );

    vi.stubEnv("APP_PASSWORD_HASH", "scrypt$16384$8$1$a$b");
    vi.stubEnv("SESSION_SECRET", "too-short");

    expect(() => getAuthConfiguration()).toThrowError(
      expect.objectContaining({ status: 503, code: "AUTH_NOT_CONFIGURED" }),
    );
  });

  it("uses a secure host-only cookie in production and clears it on logout", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");

    expect(getSessionCookieName()).toBe("__Host-domainflow_session");
    expect(sessionCookie("signed.token")).toContain("Path=/");
    expect(sessionCookie("signed.token")).toContain("HttpOnly");
    expect(sessionCookie("signed.token")).toContain("Secure");
    expect(sessionCookie("signed.token")).toContain("SameSite=Strict");
    expect(sessionCookie("signed.token")).toContain("Max-Age=604800");
    expect(clearSessionCookie()).toContain("Max-Age=0");
    expect(clearSessionCookie()).toContain("__Host-domainflow_session=");
  });
});

describe("same-origin request checks", () => {
  it("accepts a same-origin state-changing request", () => {
    expect(() =>
      assertSameOrigin(
        new Request("https://domainflow.example/api/domains", {
          method: "POST",
          headers: {
            origin: "https://domainflow.example",
            "sec-fetch-site": "same-origin",
          },
        }),
      ),
    ).not.toThrow();
  });

  it("rejects missing, cross-origin, and cross-site origins", () => {
    const target = "https://domainflow.example/api/domains";

    expect(() => assertSameOrigin(new Request(target, { method: "POST" }))).toThrowError(
      expect.objectContaining({ status: 403, code: "CSRF_REJECTED" }),
    );
    expect(() =>
      assertSameOrigin(
        new Request(target, {
          method: "POST",
          headers: { origin: "https://attacker.example" },
        }),
      ),
    ).toThrowError(expect.objectContaining({ status: 403, code: "CSRF_REJECTED" }));
    expect(() =>
      assertSameOrigin(
        new Request(target, {
          method: "POST",
          headers: {
            origin: "https://domainflow.example",
            "sec-fetch-site": "cross-site",
          },
        }),
      ),
    ).toThrowError(expect.objectContaining({ status: 403, code: "CSRF_REJECTED" }));
  });
});
