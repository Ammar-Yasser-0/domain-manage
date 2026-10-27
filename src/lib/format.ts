import type { DateOnly } from "../types/domain";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const cairoDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Cairo",
});

export function formatDate(value: DateOnly): string {
  return dateFormatter.format(new Date(value + "T00:00:00.000Z"));
}

export function formatRelativeDays(days: number): string {
  if (days < 0) {
    const overdue = Math.abs(days);
    return overdue + (overdue === 1 ? " day overdue" : " days overdue");
  }

  if (days === 0) {
    return "Today";
  }

  return days + (days === 1 ? " day" : " days");
}

export function formatCairoDateTime(value: string): string {
  return cairoDateTimeFormatter.format(new Date(value));
}
