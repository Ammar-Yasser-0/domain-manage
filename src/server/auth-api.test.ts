import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, createPasswordHash } from "./auth";

const { databaseQuery } = vi.hoisted(() => ({ databaseQuery: vi.fn() }));

vi.mock("./db", () => ({
  getSql: () => ({ query: databaseQuery }),
}));

import domainsApi from "../../api/domains";
import domainItemApi from "../../api/domains/[id]";
import renewApi from "../../api/domains/[id]/renew";
import historyApi from "../../api/domains/[id]/history";
import exportApi from "../../api/exports/domains";
import loginApi from "../../api/auth/login";
import logoutApi from "../../api/auth/logout";
import sessionApi from "../../api/auth/session";

const password = "an example private workspace password";
const sessionSecret = Buffer.from("DomainFlow test session key 32 bytes!", "utf8");
let encodedPasswordHash = "";

beforeAll(async () => {
  encodedPasswordHash = await createPasswordHash(password);
});

beforeEach(() => {
  vi.stubEnv("APP_PASSWORD_HASH", encodedPasswordHash);
  vi.stubEnv("SESSION_SECRET", sessionSecret.toString("base64url"));
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "");
  databaseQuery.mockReset();
  databaseQuery.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(
  method: string,
  path: string,
  options: { body?: unknown; cookie?: string; origin?: string; ipAddress?: string } = {},
): Request {
  const headers = new Headers();

  if (options.cookie) {
    headers.set("cookie", options.cookie);
  }
  if (options.origin !== undefined) {
    headers.set("origin", options.origin);
  }
  if (options.ipAddress !== undefined) {
    headers.set("x-forwarded-for", options.ipAddress);
  }
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  return new Request("https://domainflow.example" + path, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function loginWith(value: string): Promise<Response> {
  databaseQuery.mockResolvedValueOnce([{ limited: false, retry_after_seconds: 0 }]);

  return loginApi.fetch(
    request("POST", "/api/auth/login", {
      body: { password: value },
      origin: "https://domainflow.example",
    }),
  );
}

function sessionCookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const value = /(?:^|,\s*)domainflow_session=([^;]+)/.exec(setCookie)?.[1];

  if (!value) {
    throw new Error("The login response did not set a session cookie.");
  }

  return "domainflow_session=" + value;
}

describe("password-only authentication endpoints", () => {
  it("accepts the configured password and sets a signed HttpOnly session cookie", async () => {
    const response = await loginWith(password);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=604800");
    expect(await response.json()).toEqual({ authenticated: true });

    const status = await sessionApi.fetch(
      request("GET", "/api/auth/session", { cookie: sessionCookieFrom(response) }),
    );
    expect(await status.json()).toEqual({ configured: true, authenticated: true });
  });

  it("rejects an incorrect password with a generic 401 and no session cookie", async () => {
    const response = await loginWith("a different incorrect password");

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("reports an unconfigured login without exposing secret values", async () => {
    vi.stubEnv("APP_PASSWORD_HASH", "");

    const response = await sessionApi.fetch(request("GET", "/api/auth/session"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: false, authenticated: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("clears an expired session cookie from the status response", async () => {
    const expiredToken = createSessionToken(
      sessionSecret,
      Date.now() - 8 * 24 * 60 * 60 * 1000,
    );
    const response = await sessionApi.fetch(
      request("GET", "/api/auth/session", {
        cookie: "domainflow_session=" + expiredToken,
      }),
    );

    expect(await response.json()).toEqual({ configured: true, authenticated: false });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("logs out by expiring the session cookie", async () => {
    const response = await logoutApi.fetch(
      request("POST", "/api/auth/logout", {
        origin: "https://domainflow.example",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("domainflow_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await response.json()).toEqual({ authenticated: false });
  });

  it("rejects a cross-origin login attempt", async () => {
    const response = await loginApi.fetch(
      request("POST", "/api/auth/login", {
        body: { password },
        origin: "https://attacker.example",
      }),
    );

    expect(response.status).toBe(403);
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it("uses persistent throttling and returns Retry-After without checking a password", async () => {
    databaseQuery.mockResolvedValueOnce([
      { limited: true, retry_after_seconds: 620 },
    ]);

    const response = await loginApi.fetch(
      request("POST", "/api/auth/login", {
        body: { password },
        origin: "https://domainflow.example",
        ipAddress: "192.0.2.44",
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("620");
    expect(databaseQuery.mock.calls[0][0]).toContain("ON CONFLICT (bucket_key)");
    expect(String(databaseQuery.mock.calls[0][1][0])).toMatch(/^[a-f0-9]{64}$/);
    expect(databaseQuery.mock.calls[0][1]).toEqual([
      expect.stringMatching(/^[a-f0-9]{64}$/),
      900,
      900,
      10,
    ]);
    expect(String(databaseQuery.mock.calls[0][1][0])).not.toContain("192.0.2.44");
  });
});

describe("protected API routes", () => {
  const protectedRequests: Array<{
    name: string;
    api: { fetch: (request: Request) => Promise<Response> };
    method: string;
    path: string;
    body?: unknown;
  }> = [
    { name: "GET domains", api: domainsApi, method: "GET", path: "/api/domains" },
    { name: "POST domains", api: domainsApi, method: "POST", path: "/api/domains", body: { domainName: "safe.test", expirationDate: "2030-01-01" } },
    { name: "PUT domain", api: domainItemApi, method: "PUT", path: "/api/domains/2a27b9a9-85f7-42a4-9c18-f32943c06d0c", body: { domainName: "safe.test", expirationDate: "2030-01-01" } },
    { name: "DELETE domain", api: domainItemApi, method: "DELETE", path: "/api/domains/2a27b9a9-85f7-42a4-9c18-f32943c06d0c" },
    { name: "POST renewal", api: renewApi, method: "POST", path: "/api/domains/2a27b9a9-85f7-42a4-9c18-f32943c06d0c/renew", body: { years: 1 } },
    { name: "GET renewal history", api: historyApi, method: "GET", path: "/api/domains/2a27b9a9-85f7-42a4-9c18-f32943c06d0c/history" },
    { name: "GET CSV export", api: exportApi, method: "GET", path: "/api/exports/domains" },
  ];

  for (const testCase of protectedRequests) {
    it(`returns 401 for unauthenticated ${testCase.name} without querying records`, async () => {
      const response = await testCase.api.fetch(
        request(testCase.method, testCase.path, { body: testCase.body }),
      );

      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({
        error: { code: "UNAUTHENTICATED" },
      });
      expect(databaseQuery).not.toHaveBeenCalled();
    });
  }

  it("returns 503 before touching data when auth configuration is missing", async () => {
    vi.stubEnv("SESSION_SECRET", "");

    const response = await domainsApi.fetch(request("GET", "/api/domains"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "AUTH_NOT_CONFIGURED" },
    });
    expect(databaseQuery).not.toHaveBeenCalled();
  });

  it("rejects cross-origin mutations for an authenticated session", async () => {
    const token = createSessionToken(sessionSecret);
    const response = await domainsApi.fetch(
      request("POST", "/api/domains", {
        body: { domainName: "safe.test", expirationDate: "2030-01-01" },
        cookie: "domainflow_session=" + token,
        origin: "https://attacker.example",
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "CSRF_REJECTED" },
    });
    expect(databaseQuery).not.toHaveBeenCalled();
  });
});
