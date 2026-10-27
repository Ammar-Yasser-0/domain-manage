import type {
  DomainMutationResponse,
  DomainRecord,
  RenewalMutationResponse,
  RenewalRecord,
} from "../types/domain";
import { ApiError } from "./http";
import { getSql } from "./db";

interface DbDomain {
  id: string;
  domain_name: string;
  expiration_date: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
}

interface DbRenewal {
  id: string;
  domain_id: string;
  previous_expiration_date: string | Date;
  renewed_expiration_date: string | Date;
  renewal_years: number;
  renewed_at: string | Date;
}

interface DbRenewalMutation extends DbDomain {
  renewal_id: string;
  domain_id: string;
  previous_expiration_date: string | Date;
  renewed_expiration_date: string | Date;
  renewal_years: number;
  renewed_at: string | Date;
}

export async function listDomains(): Promise<DomainRecord[]> {
  const rows = (await getSql().query(
    "SELECT id, domain_name, expiration_date, created_at, updated_at " +
      "FROM domains ORDER BY expiration_date ASC, domain_name ASC",
  )) as DbDomain[];

  return rows.map(toDomain);
}

export async function createDomain(
  domainName: string,
  expirationDate: string,
): Promise<DomainMutationResponse> {
  try {
    const rows = (await getSql().query(
      "INSERT INTO domains (domain_name, expiration_date) " +
        "VALUES ($1, $2::date) " +
        "RETURNING id, domain_name, expiration_date, created_at, updated_at",
      [domainName, expirationDate],
    )) as DbDomain[];

    return { item: toDomain(rows[0]) };
  } catch (error) {
    throwDatabaseConflict(error);
  }
}

export async function updateDomain(
  id: string,
  domainName: string,
  expirationDate: string,
): Promise<DomainMutationResponse> {
  try {
    const rows = (await getSql().query(
      "UPDATE domains SET domain_name = $2, expiration_date = $3::date, " +
        "updated_at = now() WHERE id = $1::uuid " +
        "RETURNING id, domain_name, expiration_date, created_at, updated_at",
      [id, domainName, expirationDate],
    )) as DbDomain[];

    if (rows.length === 0) {
      throw new ApiError(404, "DOMAIN_NOT_FOUND", "This domain no longer exists.");
    }

    return { item: toDomain(rows[0]) };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throwDatabaseConflict(error);
  }
}

export async function deleteDomain(id: string): Promise<void> {
  const rows = (await getSql().query(
    "DELETE FROM domains WHERE id = $1::uuid RETURNING id",
    [id],
  )) as Array<{ id: string }>;

  if (rows.length === 0) {
    throw new ApiError(404, "DOMAIN_NOT_FOUND", "This domain no longer exists.");
  }
}

export async function renewDomain(
  id: string,
  years: number,
): Promise<RenewalMutationResponse> {
  const rows = (await getSql().query(RENEW_DOMAIN_SQL, [id, years])) as
    | DbRenewalMutation[]
    | undefined;

  if (!rows || rows.length === 0) {
    const existing = (await getSql().query(
      "SELECT id FROM domains WHERE id = $1::uuid",
      [id],
    )) as Array<{ id: string }>;

    if (existing.length === 0) {
      throw new ApiError(404, "DOMAIN_NOT_FOUND", "This domain no longer exists.");
    }

    throw new ApiError(
      422,
      "RENEWAL_DATE_OUT_OF_RANGE",
      "This renewal would exceed the supported calendar date range.",
    );
  }

  const row = rows[0];
  const domain = toDomain(row);

  return {
    item: domain,
    renewal: {
      id: row.renewal_id,
      domainId: row.domain_id,
      previousExpirationDate: toDateOnly(row.previous_expiration_date),
      renewedExpirationDate: toDateOnly(row.renewed_expiration_date),
      renewalYears: Number(row.renewal_years),
      renewedAt: toIsoTimestamp(row.renewed_at),
    },
  };
}

export async function listRenewalHistory(id: string): Promise<RenewalRecord[]> {
  const rows = (await getSql().query(
    "SELECT d.id AS domain_id, h.id, h.previous_expiration_date, " +
      "h.renewed_expiration_date, h.renewal_years, h.renewed_at " +
      "FROM domains AS d LEFT JOIN renewal_history AS h ON h.domain_id = d.id " +
      "WHERE d.id = $1::uuid ORDER BY h.renewed_at DESC NULLS LAST",
    [id],
  )) as Array<DbRenewal & { domain_id: string }>;

  if (rows.length === 0) {
    throw new ApiError(404, "DOMAIN_NOT_FOUND", "This domain no longer exists.");
  }

  return rows
    .filter((row) => Boolean(row.id))
    .map((row) => ({
      id: row.id,
      domainId: row.domain_id,
      previousExpirationDate: toDateOnly(row.previous_expiration_date),
      renewedExpirationDate: toDateOnly(row.renewed_expiration_date),
      renewalYears: Number(row.renewal_years),
      renewedAt: toIsoTimestamp(row.renewed_at),
    }));
}

export function toDomain(row: DbDomain): DomainRecord {
  return {
    id: row.id,
    domainName: row.domain_name,
    expirationDate: toDateOnly(row.expiration_date),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

function toDateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function toIsoTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function throwDatabaseConflict(error: unknown): never {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  if (code === "23505") {
    throw new ApiError(
      409,
      "DOMAIN_EXISTS",
      "A domain with this name already exists.",
    );
  }

  throw error;
}

const RENEW_DOMAIN_SQL = [
  "WITH current_domain AS MATERIALIZED (",
  "  SELECT id, expiration_date FROM domains WHERE id = $1::uuid FOR UPDATE",
  "), updated AS (",
  "  UPDATE domains AS d",
  "  SET expiration_date = (current_domain.expiration_date +",
  "    make_interval(years => $2::integer))::date, updated_at = now()",
  "  FROM current_domain",
  "  WHERE d.id = current_domain.id AND",
  "    (current_domain.expiration_date + make_interval(years => $2::integer))::date",
  "      <= DATE '9999-12-31'",
  "  RETURNING d.id, d.domain_name, d.expiration_date, d.created_at,",
  "    d.updated_at",
  "), history AS (",
  "  INSERT INTO renewal_history",
  "    (domain_id, previous_expiration_date, renewed_expiration_date, renewal_years)",
  "  SELECT updated.id, current_domain.expiration_date, updated.expiration_date,",
  "    $2::smallint FROM updated JOIN current_domain",
  "    ON current_domain.id = updated.id",
  "  RETURNING id, domain_id, previous_expiration_date,",
  "    renewed_expiration_date, renewal_years, renewed_at",
  ")",
  "SELECT updated.id, updated.domain_name, updated.expiration_date,",
  "  updated.created_at, updated.updated_at, history.id AS renewal_id,",
  "  history.domain_id, history.previous_expiration_date,",
  "  history.renewed_expiration_date, history.renewal_years, history.renewed_at",
  "FROM updated JOIN history ON history.domain_id = updated.id",
].join("\n");
