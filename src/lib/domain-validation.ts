import { isDateOnly } from "./domain-date";
import type { DomainInput } from "../types/domain";

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; field: string; message: string };

export function normalizeDomainName(value: string): string {
  return value.trim().replace(/\.$/, "").toLowerCase();
}

export function validateDomainName(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, field: "domainName", message: "Enter a domain name." };
  }

  const normalized = normalizeDomainName(value);
  const labels = normalized.split(".");
  const validLabels = labels.every(
    (label) =>
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  );

  if (
    normalized.length > 253 ||
    labels.length < 2 ||
    !validLabels ||
    labels.at(-1)?.length === 0
  ) {
    return {
      ok: false,
      field: "domainName",
      message: "Enter a valid domain such as example.com, without https://.",
    };
  }

  return { ok: true, value: normalized };
}

export function validateExpirationDate(
  value: unknown,
): ValidationResult<string> {
  if (typeof value !== "string" || !isDateOnly(value)) {
    return {
      ok: false,
      field: "expirationDate",
      message: "Enter a valid expiration date.",
    };
  }

  return { ok: true, value };
}

export function validateDomainInput(
  input: unknown,
): ValidationResult<DomainInput> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, field: "body", message: "Enter domain details." };
  }

  const body = input as Record<string, unknown>;
  const domain = validateDomainName(body.domainName);

  if (!domain.ok) {
    return domain;
  }

  const date = validateExpirationDate(body.expirationDate);

  if (!date.ok) {
    return date;
  }

  return {
    ok: true,
    value: { domainName: domain.value, expirationDate: date.value },
  };
}

export function validateRenewalYears(
  value: unknown,
): ValidationResult<number> {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 99
  ) {
    return {
      ok: false,
      field: "years",
      message: "Choose a whole number of years from 1 to 99.",
    };
  }

  return { ok: true, value };
}
