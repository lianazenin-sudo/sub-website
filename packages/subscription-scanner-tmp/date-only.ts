/**
 * Helpers for calendar dates ("YYYY-MM-DD").
 *
 * Subscription dates are days, not moments. Keeping them as ISO strings and
 * doing every calculation in UTC avoids the classic bug where a renewal date
 * moves by one day when converted between time zones.
 */
import type { DateOnly } from "./types";

const MS_PER_DAY = 86_400_000;

/** Zero-pads a number to two digits ("7" → "07"). */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Builds a DateOnly from year, month (1–12) and day, or returns null for an
 * impossible date such as 2026-02-30. Validation round-trips through Date.UTC:
 * an invalid day rolls into the next month, which the comparison detects.
 */
export function makeDateOnly(
  year: number,
  month: number,
  day: number,
): DateOnly | null {
  if (![year, month, day].every(Number.isInteger)) return null;
  if (
    year < 1900 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Returns the UTC calendar day that a moment falls on. */
export function toDateOnly(moment: Date): DateOnly {
  return moment.toISOString().slice(0, 10);
}

/** Converts a calendar day to a Date at 00:00 UTC on that day. */
export function dateOnlyToUtc(value: DateOnly): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Adds (or, if negative, subtracts) whole days. */
export function addDays(value: DateOnly, days: number): DateOnly {
  return toDateOnly(
    new Date(dateOnlyToUtc(value).getTime() + days * MS_PER_DAY),
  );
}

/**
 * Adds whole calendar months, clamping to the last day of the target month
 * (Jan 31 + 1 month = Feb 28/29). This mirrors how billing systems roll
 * monthly renewals.
 */
export function addMonths(value: DateOnly, months: number): DateOnly {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const monthIndex = y * 12 + (m - 1) + months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex - targetYear * 12 + 1;
  // Day 0 of the following month is the last day of the target month.
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const result = makeDateOnly(targetYear, targetMonth, Math.min(d, lastDay));
  if (!result)
    throw new Error(
      `addMonths produced an invalid date from ${value} + ${months}`,
    );
  return result;
}

/** Absolute number of whole days between two calendar dates. */
export function daysBetween(a: DateOnly, b: DateOnly): number {
  return Math.round(
    Math.abs(dateOnlyToUtc(a).getTime() - dateOnlyToUtc(b).getTime()) /
      MS_PER_DAY,
  );
}

/** Moves a moment back by whole calendar months (used for the initial scan window). */
export function subtractMonths(moment: Date, months: number): Date {
  return dateOnlyToUtc(addMonths(toDateOnly(moment), -months));
}
