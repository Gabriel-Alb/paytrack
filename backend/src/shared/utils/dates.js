import { env } from "../../config/env.js";

export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: env.TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function daysLate(due, date) {
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) /
        86400000,
    ),
  );
}

export function visualStatus(days, feePending = false) {
  if (days > env.ATTENTION_DAYS) return "overdue";
  if (days > 0 || feePending) return "attention";
  return "on-time";
}
