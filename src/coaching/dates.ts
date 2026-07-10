import { DateTime } from "luxon";
import { z } from "zod";

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO 8601 date (YYYY-MM-DD)");

export function parseUserDate(value: string, timezone: string): DateTime {
  const parsed = DateTime.fromISO(value, { zone: timezone });
  if (!parsed.isValid || parsed.toISODate() !== value) {
    throw new Error(`Invalid date '${value}' in timezone ${timezone}`);
  }
  return parsed.startOf("day");
}

export function today(timezone: string, now: DateTime = DateTime.now()): DateTime {
  return now.setZone(timezone).startOf("day");
}

export function dateRange(startDate: string, endDate: string, timezone: string): { start: DateTime; end: DateTime } {
  const start = parseUserDate(startDate, timezone);
  const end = parseUserDate(endDate, timezone);
  if (end < start) throw new Error("endDate must not be before startDate");
  return { start, end };
}
