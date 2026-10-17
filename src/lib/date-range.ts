/**
 * Shared date-range helpers.
 *
 * getDateRange() was copy-pasted verbatim (~65 lines) across all four report
 * routes; the month-boundary maths below was duplicated in dashboard, catalog,
 * orders and orders/[id]. Both now live here.
 *
 * All returned boundaries are `YYYY-MM-DD` strings, which is how order_date is
 * stored, so they can be compared directly with $gte/$lte.
 */

const YYYY_MM = /^\d{4}-(0[1-9]|1[0-2])$/;
const YYYY_MM_DD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** True for a well-formed `YYYY-MM` string. */
export function isValidYearMonth(value: string): boolean {
  return YYYY_MM.test(value);
}

/**
 * True for a well-formed `YYYY-MM-DD` string — the format order_date is
 * stored and compared in. Used to validate the API's order_date input: an
 * unpadded or slash-separated value makes getMonthRange() produce a range
 * that matches zero orders, which silently bypasses the monthly quota check.
 */
export function isValidDate(value: string): boolean {
  return YYYY_MM_DD.test(value);
}

/** First and last day of a `YYYY-MM` month, as YYYY-MM-DD strings. */
export function getMonthRange(month: string): { start: string; end: string } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const m = Number(monthStr);
  const lastDay = new Date(year, m, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** The current month as a `YYYY-MM` string. */
export function currentYearMonth(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Format a Date as a local `YYYY-MM-DD` string.
 *
 * Deliberately does NOT use `toISOString()`, which converts to UTC. The
 * weekly branch used to build dates with local constructors (`new Date(y, 0, 1)`)
 * but format them via `toISOString()`. In any timezone at or east of UTC —
 * including Asia/Kuching (UTC+8), where this app runs — local midnight falls
 * on the previous UTC day, so every week boundary came out a day early.
 * Reading the local calendar parts keeps construction and formatting in the
 * same frame, so the result is identical in every timezone.
 */
function formatLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type ReportType = "daily" | "weekly" | "monthly" | "yearly";

/** `YYYY-Www` — the value format of `<input type="week">`. */
const ISO_WEEK = /^(\d{4})-W(\d{1,2})$/;

/**
 * Monday of ISO-8601 week `week` (e.g. "2026-W13"), or null when the string
 * is absent/malformed or names a week the year does not have (e.g. 2021 has
 * 52 ISO weeks, so "2021-W53" is rejected).
 *
 * ISO week 1 is the week containing Jan 4 — equivalently, the week whose
 * Thursday falls in January — which makes leap years and year boundaries fall
 * out correctly. Anchoring on Jan 4 (not Jan 1) is what distinguishes ISO-8601
 * from a naive "Monday of the week containing Jan 1" rule for years whose
 * Jan 1 falls Fri/Sat/Sun.
 */
function isoWeekStart(week: string | null | undefined): Date | null {
  const match = week ? ISO_WEEK.exec(week.trim()) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const weekNum = Number(match[2]);
  if (weekNum < 1 || weekNum > 53) return null;

  // Jan 4 is always inside ISO week 1, so back up to that week's Monday.
  const jan4 = new Date(year, 0, 4);
  const start = new Date(
    year,
    0,
    4 - ((jan4.getDay() || 7) - 1) + (weekNum - 1) * 7
  );

  // The Thursday of week N must still fall inside `year`, else the year has
  // no such week (a 52-week year's "week 53" spills into the next year).
  const thursday = new Date(start);
  thursday.setDate(thursday.getDate() + 3);
  return thursday.getFullYear() === year ? start : null;
}

/** Monday of the local week containing `now`. */
function currentWeekStart(now: Date): Date {
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() || 7) - 1));
  return start;
}

/**
 * The ISO-8601 week containing `now`, as `YYYY-Www`.
 *
 * This is the exact value `<input type="week">` holds for that date, so the
 * reports UI's default week and the server's getDateRange() agree on both the
 * week number and its numbering year (which can differ from the calendar year
 * around new year: Fri 2027-01-01 is in 2026-W53).
 */
export function currentIsoWeek(now: Date = new Date()): string {
  // Shift to the Thursday of the current week: its calendar year is the ISO
  // week-numbering year.
  const thursday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  thursday.setDate(thursday.getDate() + (4 - (thursday.getDay() || 7)));

  const isoYear = thursday.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  const week1Monday = new Date(isoYear, 0, 4 - ((jan4.getDay() || 7) - 1));

  // Whole-day difference; Math.round absorbs any DST hour-skew.
  const days = Math.round(
    (thursday.getTime() - week1Monday.getTime()) / 86400000
  );
  const weekNum = Math.floor(days / 7) + 1;
  return `${isoYear}-W${String(weekNum).padStart(2, "0")}`;
}

export interface DateRangeInput {
  type: string;
  date?: string | null;
  week?: string | null;
  month?: string | null;
  year?: string | null;
  now?: Date;
}

/**
 * Resolve report query params into an inclusive `{ start, end }` date range.
 * Unknown types fall back to daily, matching the original behaviour.
 */
export function getDateRange({
  type,
  date,
  week,
  month,
  year,
  now = new Date(),
}: DateRangeInput): { start: string; end: string } {
  switch (type) {
    case "daily": {
      const d = date || formatLocal(now);
      return { start: d, end: d };
    }
    case "weekly": {
      // ISO-8601 weeks (Monday..Sunday), matching what <input type="week">
      // emits. A missing/malformed/invalid week falls back to the current one.
      const start = isoWeekStart(week) ?? currentWeekStart(now);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start: formatLocal(start), end: formatLocal(end) };
    }
    case "monthly": {
      if (month) return getMonthRange(month);
      return getMonthRange(currentYearMonth(now));
    }
    case "yearly": {
      const yr = year ? parseInt(year) : now.getFullYear();
      return { start: `${yr}-01-01`, end: `${yr}-12-31` };
    }
    default: {
      const d = date || formatLocal(now);
      return { start: d, end: d };
    }
  }
}
