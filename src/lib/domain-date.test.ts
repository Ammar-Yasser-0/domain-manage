import { describe, expect, it } from "vitest";
import {
  addYearsToDate,
  getCairoToday,
  getDomainDateStatus,
} from "./domain-date";

describe("getCairoToday", () => {
  it("uses the Cairo calendar date close to UTC midnight", () => {
    expect(getCairoToday(new Date("2026-10-26T22:30:00.000Z"))).toBe(
      "2026-10-27",
    );
  });
});

describe("getDomainDateStatus", () => {
  it("treats an expiration date before today as expired", () => {
    expect(getDomainDateStatus("2026-10-26", "2026-10-27")).toEqual({
      status: "expired",
      daysRemaining: -1,
    });
  });

  it("includes today and day 30 in the expiring-soon range", () => {
    expect(getDomainDateStatus("2026-10-27", "2026-10-27")).toEqual({
      status: "expiring-soon",
      daysRemaining: 0,
    });
    expect(getDomainDateStatus("2026-11-26", "2026-10-27")).toEqual({
      status: "expiring-soon",
      daysRemaining: 30,
    });
  });

  it("marks day 31 as active", () => {
    expect(getDomainDateStatus("2026-11-27", "2026-10-27")).toEqual({
      status: "active",
      daysRemaining: 31,
    });
  });
});

describe("addYearsToDate", () => {
  it("clamps leap day to the last valid day of February", () => {
    expect(addYearsToDate("2024-02-29", 1)).toBe("2025-02-28");
  });

  it("keeps leap day when the target year is also a leap year", () => {
    expect(addYearsToDate("2024-02-29", 4)).toBe("2028-02-29");
  });

  it("preserves the original expiration date's month and day", () => {
    expect(addYearsToDate("2026-01-31", 2)).toBe("2028-01-31");
  });

  it("rejects renewal dates beyond the supported four-digit year range", () => {
    expect(() => addYearsToDate("9999-12-31", 1)).toThrow(RangeError);
  });
});
