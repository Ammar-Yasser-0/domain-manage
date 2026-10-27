export type DateOnly = string;

export type DomainStatus = "active" | "expiring-soon" | "expired";

export interface DomainInput {
  domainName: string;
  expirationDate: string;
}

export interface DomainRecord {
  id: string;
  domainName: string;
  expirationDate: DateOnly;
  createdAt: string;
  updatedAt: string;
}

export interface RenewalRecord {
  id: string;
  domainId: string;
  previousExpirationDate: DateOnly;
  renewedExpirationDate: DateOnly;
  renewalYears: number;
  renewedAt: string;
}

export interface DomainsResponse {
  items: DomainRecord[];
  today: DateOnly;
}

export interface DomainMutationResponse {
  item: DomainRecord;
}

export interface RenewalMutationResponse {
  item: DomainRecord;
  renewal: RenewalRecord;
}

export interface RenewalHistoryResponse {
  items: RenewalRecord[];
}

export interface DomainDateStatus {
  status: DomainStatus;
  daysRemaining: number;
}
