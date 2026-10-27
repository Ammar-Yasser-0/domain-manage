import { getDomainDateStatus } from "./domain-date";
import type { DateOnly, DomainDateStatus, DomainRecord, DomainStatus } from "../types/domain";

export type DomainFilter = "all" | DomainStatus;

export interface DomainCounts {
  all: number;
  active: number;
  "expiring-soon": number;
  expired: number;
}

export function countDomains(
  domains: DomainRecord[],
  today: DateOnly,
): DomainCounts {
  const counts: DomainCounts = {
    all: domains.length,
    active: 0,
    "expiring-soon": 0,
    expired: 0,
  };

  for (const domain of domains) {
    counts[getDomainDateStatus(domain.expirationDate, today).status] += 1;
  }

  return counts;
}

export function filterAndSortDomains(
  domains: DomainRecord[],
  filter: DomainFilter,
  search: string,
  today: DateOnly,
): DomainRecord[] {
  const query = search.trim().toLowerCase();
  const matching = domains.filter((domain) => {
    const status = getDomainDateStatus(domain.expirationDate, today).status;
    const matchesStatus = filter === "all" || status === filter;
    const matchesSearch = !query || domain.domainName.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  return matching.sort((left, right) => compareByRenewalUrgency(left, right, today));
}

function compareByRenewalUrgency(
  left: DomainRecord,
  right: DomainRecord,
  today: DateOnly,
): number {
  const leftStatus: DomainDateStatus = getDomainDateStatus(left.expirationDate, today);
  const rightStatus: DomainDateStatus = getDomainDateStatus(right.expirationDate, today);

  if (leftStatus.status === "expired" && rightStatus.status !== "expired") {
    return 1;
  }

  if (rightStatus.status === "expired" && leftStatus.status !== "expired") {
    return -1;
  }

  if (leftStatus.status === "expired" && rightStatus.status === "expired") {
    return rightStatus.daysRemaining - leftStatus.daysRemaining;
  }

  return (
    left.expirationDate.localeCompare(right.expirationDate) ||
    left.domainName.localeCompare(right.domainName)
  );
}
