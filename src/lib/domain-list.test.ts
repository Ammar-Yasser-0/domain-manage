import { describe, expect, it } from "vitest";
import { countDomains, filterAndSortDomains } from "./domain-list";
import type { DomainRecord } from "../types/domain";

const today = "2026-10-27";
const domains: DomainRecord[] = [
  makeDomain("active-later.com", "2027-01-01"),
  makeDomain("expired-older.com", "2026-10-01"),
  makeDomain("soon.com", "2026-11-10"),
  makeDomain("expired-recent.com", "2026-10-20"),
  makeDomain("active-first.com", "2026-11-27"),
];

describe("domain dashboard summary", () => {
  it("counts each date status using the supplied Cairo date", () => {
    expect(countDomains(domains, today)).toEqual({
      all: 5,
      active: 2,
      "expiring-soon": 1,
      expired: 2,
    });
  });
});

describe("domain filtering and ordering", () => {
  it("searches without case sensitivity and matches partial names", () => {
    expect(
      filterAndSortDomains(domains, "all", " SOON ", today).map(
        (domain) => domain.domainName,
      ),
    ).toEqual(["soon.com"]);
  });

  it("filters to the selected status", () => {
    expect(
      filterAndSortDomains(domains, "expired", "", today).map(
        (domain) => domain.domainName,
      ),
    ).toEqual(["expired-recent.com", "expired-older.com"]);
  });

  it("sorts upcoming dates first and expired dates by least overdue", () => {
    expect(
      filterAndSortDomains(domains, "all", "", today).map(
        (domain) => domain.domainName,
      ),
    ).toEqual([
      "soon.com",
      "active-first.com",
      "active-later.com",
      "expired-recent.com",
      "expired-older.com",
    ]);
  });
});

function makeDomain(domainName: string, expirationDate: string): DomainRecord {
  return {
    id: domainName,
    domainName,
    expirationDate,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
