import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./http";
import { createDomain, renewDomain } from "./domains";

const { databaseQuery } = vi.hoisted(() => ({ databaseQuery: vi.fn() }));

vi.mock("./db", () => ({
  getSql: () => ({ query: databaseQuery }),
}));

describe("domain database operations", () => {
  beforeEach(() => {
    databaseQuery.mockReset();
  });

  it("uses parameterized values when creating a domain", async () => {
    databaseQuery.mockResolvedValueOnce([
      {
        id: "2a27b9a9-85f7-42a4-9c18-f32943c06d0c",
        domain_name: "example.com",
        expiration_date: "2028-02-29",
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
      },
    ]);

    await createDomain("example.com", "2028-02-29");

    expect(databaseQuery).toHaveBeenCalledOnce();
    expect(databaseQuery.mock.calls[0][1]).toEqual([
      "example.com",
      "2028-02-29",
    ]);
    expect(databaseQuery.mock.calls[0][0]).toContain("VALUES ($1, $2::date)");
  });

  it("maps duplicate-name database errors to a safe conflict response", async () => {
    databaseQuery.mockRejectedValueOnce(Object.assign(new Error("private detail"), { code: "23505" }));

    await expect(createDomain("example.com", "2028-02-29")).rejects.toMatchObject({
      status: 409,
      code: "DOMAIN_EXISTS",
      message: "A domain with this name already exists.",
    });
  });
});

describe("domain renewal operation", () => {
  beforeEach(() => {
    databaseQuery.mockReset();
  });

  it("updates the date and records history in one locked SQL operation", async () => {
    const domainId = "2a27b9a9-85f7-42a4-9c18-f32943c06d0c";
    databaseQuery.mockResolvedValueOnce([
      {
        id: domainId,
        domain_id: domainId,
        domain_name: "example.com",
        expiration_date: "2029-02-28",
        created_at: "2026-10-27T12:00:00.000Z",
        updated_at: "2026-10-27T12:00:00.000Z",
        renewal_id: "a3c81d35-3e6c-4b44-8b58-9a733b419e5f",
        previous_expiration_date: "2026-02-28",
        renewed_expiration_date: "2029-02-28",
        renewal_years: 3,
        renewed_at: "2026-10-27T12:00:00.000Z",
      },
    ]);

    const result = await renewDomain(domainId, 3);

    expect(databaseQuery).toHaveBeenCalledOnce();
    expect(databaseQuery.mock.calls[0][1]).toEqual([domainId, 3]);
    const statement = String(databaseQuery.mock.calls[0][0]);
    expect(statement).toContain("FOR UPDATE");
    expect(statement).toContain("UPDATE domains");
    expect(statement).toContain("INSERT INTO renewal_history");
    expect(statement).toContain("<= DATE '9999-12-31'");
    expect(result).toEqual({
      item: {
        id: domainId,
        domainName: "example.com",
        expirationDate: "2029-02-28",
        createdAt: "2026-10-27T12:00:00.000Z",
        updatedAt: "2026-10-27T12:00:00.000Z",
      },
      renewal: {
        id: "a3c81d35-3e6c-4b44-8b58-9a733b419e5f",
        domainId,
        previousExpirationDate: "2026-02-28",
        renewedExpirationDate: "2029-02-28",
        renewalYears: 3,
        renewedAt: "2026-10-27T12:00:00.000Z",
      },
    });
  });

  it("returns not found if the domain row is absent", async () => {
    databaseQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = renewDomain(
      "2a27b9a9-85f7-42a4-9c18-f32943c06d0c",
      1,
    );

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      status: 404,
      code: "DOMAIN_NOT_FOUND",
    });
    expect(databaseQuery).toHaveBeenCalledTimes(2);
  });

  it("rejects a renewal beyond the supported date range without changing data", async () => {
    const domainId = "2a27b9a9-85f7-42a4-9c18-f32943c06d0c";
    databaseQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: domainId }]);

    await expect(renewDomain(domainId, 1)).rejects.toMatchObject({
      status: 422,
      code: "RENEWAL_DATE_OUT_OF_RANGE",
    });
    expect(databaseQuery).toHaveBeenCalledTimes(2);
    expect(databaseQuery.mock.calls[0][0]).toContain("<= DATE '9999-12-31'");
    expect(databaseQuery.mock.calls[1][0]).toBe(
      "SELECT id FROM domains WHERE id = $1::uuid",
    );
  });
});
