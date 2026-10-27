import type { DateOnly, DomainDateStatus } from "../types/domain";

export interface ParsedDateOnly {
  year: number;
  month: number;
  day: number;
}

export function parseDateOnly(value: string): ParsedDateOnly | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return null;
  }

  if (day > daysInMonth(year, month)) {
    return null;
  }

  return { year, month, day };
}

export function isDateOnly(value: string): value is DateOnly {
  return parseDateOnly(value) !== null;
}

export function getCairoToday(now: Date = new Date()): DateOnly {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");

  if (!year || !month || !day) {
    throw new Error("Could not determine today's date in Africa/Cairo.");
  }

  return year + "-" + month + "-" + day;
}

export function getDomainDateStatus(
  expirationDate: DateOnly,
  today: DateOnly,
): DomainDateStatus {
  const expirationOrdinal = toOrdinal(expirationDate);
  const todayOrdinal = toOrdinal(today);

  if (expirationOrdinal === null || todayOrdinal === null) {
    throw new RangeError("Expected valid YYYY-MM-DD calendar dates.");
  }

  const daysRemaining = expirationOrdinal - todayOrdinal;
  const status =
    daysRemaining < 0
      ? "expired"
      : daysRemaining <= 30
        ? "expiring-soon"
        : "active";

  return { status, daysRemaining };
}

export function addYearsToDate(expirationDate: DateOnly, years: number): DateOnly {
  const parsed = parseDateOnly(expirationDate);

  if (!parsed) {
    throw new RangeError("Expected a valid YYYY-MM-DD expiration date.");
  }

  if (!Number.isInteger(years) || years < 1 || years > 99) {
    throw new RangeError("Renewal years must be an integer from 1 to 99.");
  }

  const year = parsed.year + years;

  if (year > 9999) {
    throw new RangeError("Renewal date exceeds the supported calendar range.");
  }

  const day = Math.min(parsed.day, daysInMonth(year, parsed.month));
  return (
    String(year).padStart(4, "0") +
    "-" +
    String(parsed.month).padStart(2, "0") +
    "-" +
    String(day).padStart(2, "0")
  );
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function toOrdinal(value: string): number | null {
  const parsed = parseDateOnly(value);

  if (!parsed) {
    return null;
  }

  const previousYear = parsed.year - 1;
  const daysBeforeYear =
    previousYear * 365 +
    Math.floor(previousYear / 4) -
    Math.floor(previousYear / 100) +
    Math.floor(previousYear / 400);
  const monthLengths = [
    31,
    isLeapYear(parsed.year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  const daysBeforeMonth = monthLengths
    .slice(0, parsed.month - 1)
    .reduce((total, length) => total + length, 0);

  return daysBeforeYear + daysBeforeMonth + parsed.day - 1;
}
