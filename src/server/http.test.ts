import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  methodNotAllowed,
  readJson,
  withApiErrors,
} from "./http";

describe("API error handling", () => {
  it("returns stable API error details for expected failures", async () => {
    const handler = withApiErrors(async () => {
      throw new ApiError(422, "VALIDATION_ERROR", "Enter a domain name.", {
        field: "domainName",
      });
    });

    const response = await handler(new Request("https://example.test/api/domains"));

    expect(response.status).toBe(422);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Enter a domain name.",
        details: { field: "domainName" },
      },
    });
  });

  it("does not expose unexpected database error messages", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withApiErrors(async () => {
      throw new Error("postgres://private-user:secret@db.example.test/private");
    });

    try {
      const response = await handler(
        new Request("https://example.test/api/domains"),
      );

      expect(response.status).toBe(500);
      const body = await response.text();
      expect(body).toContain("INTERNAL_ERROR");
      expect(body).not.toContain("private-user");
      expect(body).not.toContain("secret");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("rejects non-JSON and malformed request bodies", async () => {
    await expect(
      readJson(
        new Request("https://example.test/api/domains", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });

    await expect(
      readJson(
        new Request("https://example.test/api/domains", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{broken",
        }),
      ),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_JSON" });
  });

  it("lists allowed methods on a 405 response", async () => {
    const response = methodNotAllowed(["GET", "POST"]);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
  });
});
