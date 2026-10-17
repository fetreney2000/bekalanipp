import { describe, expect, it, vi } from "vitest";
import { isOfficeHour, kuchingParts, OFFICE_TIMEZONE } from "./office-hours";

/**
 * Asia/Kuching is UTC+8 with no DST, so a Kuching wall-clock time maps to a
 * fixed UTC offset. This helper builds the absolute instant for a given
 * Kuching wall-clock time so tests are unambiguous regardless of host TZ.
 */
function kuching(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 8 * 3600 * 1000);
}

// Reference dates (2026): Jan 1 Thu, Jan 2 Fri, Jan 3 Sat, Jan 4 Sun, Jan 5 Mon.
const MON = () => kuching(2026, 1, 5, 9, 0); // Monday 09:00

describe("kuchingParts", () => {
  it("uses the Asia/Kuching zone", () => {
    expect(OFFICE_TIMEZONE).toBe("Asia/Kuching");
  });

  it("converts a UTC instant to Kuching wall-clock parts", () => {
    // 2026-01-05T01:00Z is 09:00 Monday in Kuching (UTC+8).
    const p = kuchingParts(new Date("2026-01-05T01:00:00Z"));
    expect(p).toEqual({
      year: 2026,
      month: 1,
      date: 5,
      weekday: 1, // Monday
      minutes: 9 * 60,
    });
  });

  it("rolls the date forward across the UTC midnight boundary", () => {
    // 2026-01-04T17:30Z (Sunday evening UTC) is 01:30 Monday in Kuching.
    const p = kuchingParts(new Date("2026-01-04T17:30:00Z"));
    expect(p.weekday).toBe(1);
    expect(p.date).toBe(5);
    expect(p.minutes).toBe(90);
  });
});

describe("isOfficeHour", () => {
  it("is true mid-morning on a weekday", () => {
    expect(isOfficeHour(MON())).toBe(true);
  });

  it("is true at the 08:00 start boundary (inclusive)", () => {
    expect(isOfficeHour(kuching(2026, 1, 5, 8, 0))).toBe(true);
  });

  it("is false one minute before the start boundary", () => {
    expect(isOfficeHour(kuching(2026, 1, 5, 7, 59))).toBe(false);
  });

  it("is true one minute before the end boundary", () => {
    expect(isOfficeHour(kuching(2026, 1, 5, 16, 59))).toBe(true);
  });

  it("is false at the 17:00 end boundary (exclusive)", () => {
    expect(isOfficeHour(kuching(2026, 1, 5, 17, 0))).toBe(false);
  });

  it("is false at midnight on a weekday (minutes = 0)", () => {
    expect(isOfficeHour(kuching(2026, 1, 5, 0, 0))).toBe(false);
  });

  it("is false on Saturday even during working hours", () => {
    // Jan 3 2026 is a Saturday.
    expect(isOfficeHour(kuching(2026, 1, 3, 10, 0))).toBe(false);
  });

  it("is false on Sunday even during working hours", () => {
    // Jan 4 2026 is a Sunday.
    expect(isOfficeHour(kuching(2026, 1, 4, 10, 0))).toBe(false);
  });

  it("is false on a weekday public holiday when a checker is supplied", () => {
    const isHoliday = vi.fn((iso: string) => iso === "2026-01-05");
    expect(isOfficeHour(MON(), isHoliday)).toBe(false);
    expect(isHoliday).toHaveBeenCalledWith("2026-01-05");
  });

  it("is true on a non-holiday weekday when a checker is supplied", () => {
    const isHoliday = vi.fn(() => false);
    expect(isOfficeHour(MON(), isHoliday)).toBe(true);
  });

  it("does not consult the holiday checker on a weekend", () => {
    const isHoliday = vi.fn(() => true);
    // Saturday: weekend short-circuits before the holiday lookup.
    expect(isOfficeHour(kuching(2026, 1, 3, 10, 0), isHoliday)).toBe(false);
    expect(isHoliday).not.toHaveBeenCalled();
  });

  it("ignores the host machine's local timezone", () => {
    // Pin TZ to something far from Kuching; behaviour must not change because
    // the conversion is explicit via Intl, not via Date's local getters.
    const prev = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      expect(isOfficeHour(MON())).toBe(true);
      expect(isOfficeHour(kuching(2026, 1, 3, 10, 0))).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    }
  });
});
