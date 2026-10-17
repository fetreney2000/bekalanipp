/**
 * Office-hours classification.
 *
 * Extracted from supply/page.tsx so the timezone + boundary maths is unit
 * tested. The rule decides whether a given instant counts as "masa pejabat"
 * (office hours) for the totals_by_masa KPIs.
 *
 * Sabah (Asia/Kuching) is used throughout — /api/time was switched to the
 * same zone so the two can't disagree.
 */

/** Monday-Friday, 08:00 (480 min) inclusive to 17:00 (1020 min) exclusive. */
export const OFFICE_START_MINUTES = 8 * 60;
export const OFFICE_END_MINUTES = 17 * 60;

/** The timezone every office-hours calculation must use. */
export const OFFICE_TIMEZONE = "Asia/Kuching";

/** Returns true if the given YYYY-MM-DD is a public holiday. */
export type HolidayChecker = (isoDate: string) => boolean;

/**
 * The Kuching wall-clock parts for a UTC instant, without Date parsing tricks.
 * Uses Intl so it's correct across DST-less but rule-bearing zones and immune
 * to the host machine's local timezone.
 */
export function kuchingParts(when: Date): {
  year: number;
  month: number; // 1-12
  date: number;
  weekday: number; // 0=Sun .. 6=Sat
  minutes: number; // minutes since midnight
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OFFICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(when);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    date: Number(get("day")),
    weekday: weekdayMap[get("weekday")] ?? 0,
    minutes: (hour % 24) * 60 + minute,
  };
}

/**
 * Whether an instant falls in office hours: Mon-Fri, not a public holiday,
 * and within 08:00-17:00 in Asia/Kuching.
 *
 * `isHoliday` is injected so tests don't depend on the bundled holiday DB;
 * the supply page passes a real Sabah (MY-12) checker.
 */
export function isOfficeHour(
  when: Date,
  isHoliday?: HolidayChecker
): boolean {
  const p = kuchingParts(when);

  // Sunday or Saturday.
  if (p.weekday === 0 || p.weekday === 6) return false;

  if (isHoliday) {
    const iso = `${p.year}-${String(p.month).padStart(2, "0")}-${String(
      p.date
    ).padStart(2, "0")}`;
    if (isHoliday(iso)) return false;
  }

  return p.minutes >= OFFICE_START_MINUTES && p.minutes < OFFICE_END_MINUTES;
}
