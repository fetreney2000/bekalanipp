import { describe, expect, it } from "vitest";
import {
  currentIsoWeek,
  currentYearMonth,
  getDateRange,
  getMonthRange,
  isValidDate,
  isValidYearMonth,
} from "./date-range";

describe("isValidYearMonth", () => {
  it("accepts valid YYYY-MM", () => {
    expect(isValidYearMonth("2026-01")).toBe(true);
    expect(isValidYearMonth("2026-12")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isValidYearMonth("garbage")).toBe(false);
    expect(isValidYearMonth("2026-13")).toBe(false); // month 13
    expect(isValidYearMonth("2026-00")).toBe(false); // month 0
    expect(isValidYearMonth("26-1")).toBe(false); // wrong padding
    expect(isValidYearMonth("2026/01")).toBe(false); // wrong separator
    expect(isValidYearMonth("")).toBe(false);
  });
});

describe("isValidDate", () => {
  it("accepts well-formed YYYY-MM-DD", () => {
    expect(isValidDate("2026-01-01")).toBe(true);
    expect(isValidDate("2024-02-29")).toBe(true); // leap day
    expect(isValidDate("2026-12-31")).toBe(true);
  });

  it("rejects values that would corrupt the quota month range", () => {
    expect(isValidDate("2026/02/15")).toBe(false); // wrong separator
    expect(isValidDate("2026-2-15")).toBe(false); // unpadded month
    expect(isValidDate("2026-02-5")).toBe(false); // unpadded day
    expect(isValidDate("2026-13-01")).toBe(false); // month 13
    expect(isValidDate("2026-02-32")).toBe(false); // day 32
    expect(isValidDate("2026-02-15T00:00:00Z")).toBe(false); // ISO datetime
    expect(isValidDate("garbage")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
});

describe("getMonthRange", () => {
  it("returns the first and last day of a 31-day month", () => {
    expect(getMonthRange("2026-01")).toEqual({
      start: "2026-01-01",
      end: "2026-01-31",
    });
  });

  it("returns the correct last day for a 30-day month", () => {
    expect(getMonthRange("2026-04")).toEqual({
      start: "2026-04-01",
      end: "2026-04-30",
    });
  });

  it("handles February in a common year", () => {
    expect(getMonthRange("2026-02")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("handles February in a leap year", () => {
    expect(getMonthRange("2024-02")).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    });
  });

  it("treats century years correctly (2100 is not a leap year)", () => {
    expect(getMonthRange("2100-02")).toEqual({
      start: "2100-02-01",
      end: "2100-02-28",
    });
  });
});

describe("currentYearMonth", () => {
  it("zero-pads the month", () => {
    expect(currentYearMonth(new Date(2026, 0, 15))).toBe("2026-01");
    expect(currentYearMonth(new Date(2026, 11, 31))).toBe("2026-12");
  });
});

describe("getDateRange — daily", () => {
  it("uses the explicit date when given", () => {
    expect(
      getDateRange({ type: "daily", date: "2026-03-15" })
    ).toEqual({ start: "2026-03-15", end: "2026-03-15" });
  });

  it("falls back to 'now' (the LOCAL date) when no date is given", () => {
    // Local calendar parts, so the assertion holds in every timezone — the
    // function deliberately formats from the local frame, not toISOString().
    const now = new Date(2026, 2, 15, 9, 30);
    const r = getDateRange({ type: "daily", now });
    expect(r.start).toBe("2026-03-15");
    expect(r.end).toBe("2026-03-15");
  });
});

describe("getDateRange — monthly", () => {
  it("uses the explicit month", () => {
    expect(getDateRange({ type: "monthly", month: "2026-02" })).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("falls back to the current month", () => {
    const r = getDateRange({ type: "monthly", now: new Date(2026, 4, 10) });
    expect(r).toEqual({ start: "2026-05-01", end: "2026-05-31" });
  });
});

describe("getDateRange — yearly", () => {
  it("spans the full explicit year", () => {
    expect(getDateRange({ type: "yearly", year: "2026" })).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
    });
  });

  it("falls back to the current year", () => {
    const r = getDateRange({ type: "yearly", now: new Date(2026, 6, 1) });
    expect(r).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});

describe("getDateRange — weekly (ISO-8601)", () => {
  // Convention (unified in this change): weeks are ISO-8601 — Monday..Sunday,
  // week 1 is the week containing Jan 4 — which is exactly what the reports
  // UI's <input type="week"> emits and what currentIsoWeek() defaults to.
  // The previous server rule anchored week 1 to the Monday containing Jan 1
  // and the UI guessed week numbers as Math.ceil(dayOfYear/7); the three
  // conventions disagreed for years whose Jan 1 falls Fri/Sat/Sun.
  it("resolves an explicit week to its Monday..Sunday span", () => {
    // 2026-01-01 is a Thursday, so ISO week 1 starts Mon 2025-12-29.
    expect(getDateRange({ type: "weekly", week: "2026-W01" })).toEqual({
      start: "2025-12-29",
      end: "2026-01-04",
    });
  });

  it("advances exactly 7 days per week number", () => {
    expect(getDateRange({ type: "weekly", week: "2026-W02" })).toEqual({
      start: "2026-01-05",
      end: "2026-01-11",
    });
  });

  it("handles a year where Jan 1 is a Monday (no back-up into prior year)", () => {
    // 2029-01-01 is a Monday, so week 1 starts on Jan 1 itself.
    expect(getDateRange({ type: "weekly", week: "2029-W01" })).toEqual({
      start: "2029-01-01",
      end: "2029-01-07",
    });
  });

  it("starts week 1 on Jan 2 when Jan 1 is a Sunday (ISO, not Jan-1 rule)", () => {
    // 2023-01-01 is a Sunday: the Jan-1 rule would start week 1 on 2022-12-26,
    // but ISO week 1 is the week containing Jan 4, i.e. Mon 2023-01-02.
    expect(getDateRange({ type: "weekly", week: "2023-W01" })).toEqual({
      start: "2023-01-02",
      end: "2023-01-08",
    });
  });

  it("starts week 1 on Jan 3 when Jan 1 is a Saturday (ISO, not Jan-1 rule)", () => {
    // 2022-01-01 is a Saturday; Jan 1-2 belong to the prior ISO year (2021-W52).
    expect(getDateRange({ type: "weekly", week: "2022-W01" })).toEqual({
      start: "2022-01-03",
      end: "2022-01-09",
    });
  });

  it("resolves week 53 of a 53-week year", () => {
    // 2020 starts on Wednesday in a leap year, so it has 53 ISO weeks.
    expect(getDateRange({ type: "weekly", week: "2020-W53" })).toEqual({
      start: "2020-12-28",
      end: "2021-01-03",
    });
  });

  it("falls back to the current week when the year has no such week", () => {
    // 2021 has 52 ISO weeks, so 2021-W53 does not exist.
    const r = getDateRange({
      type: "weekly",
      week: "2021-W53",
      now: new Date(2026, 0, 7, 12),
    });
    expect(r).toEqual({ start: "2026-01-05", end: "2026-01-11" });
  });

  it("falls back to the current week for malformed week values", () => {
    const now = new Date(2026, 0, 7, 12);
    expect(getDateRange({ type: "weekly", week: "garbage", now })).toEqual({
      start: "2026-01-05",
      end: "2026-01-11",
    });
    expect(getDateRange({ type: "weekly", week: "2026-W0", now })).toEqual({
      start: "2026-01-05",
      end: "2026-01-11",
    });
    expect(getDateRange({ type: "weekly", week: "2026/01", now })).toEqual({
      start: "2026-01-05",
      end: "2026-01-11",
    });
  });

  it("falls back to the current week (Mon..Sun) when no week is given", () => {
    // 2026-01-07 is a Wednesday; its week starts Mon 2026-01-05.
    const r = getDateRange({
      type: "weekly",
      now: new Date(2026, 0, 7, 12),
    });
    expect(r).toEqual({ start: "2026-01-05", end: "2026-01-11" });
  });

  it("treats Sunday as the end of the week in the fallback", () => {
    // 2026-01-11 is a Sunday; same week as Wed 2026-01-07.
    const r = getDateRange({
      type: "weekly",
      now: new Date(2026, 0, 11, 12),
    });
    expect(r).toEqual({ start: "2026-01-05", end: "2026-01-11" });
  });
});

describe("currentIsoWeek", () => {
  it("returns week 1 for a Thursday inside ISO week 1", () => {
    // 2026-01-01 is a Thursday and ISO week 1 of 2026 starts 2025-12-29.
    expect(currentIsoWeek(new Date(2026, 0, 1))).toBe("2026-W01");
  });

  it("uses the ISO week-numbering year, not the calendar year", () => {
    // Fri 2027-01-01 belongs to the week whose Thursday is 2026-12-31,
    // so its ISO week is 2026-W53.
    expect(currentIsoWeek(new Date(2027, 0, 1))).toBe("2026-W53");
    expect(currentIsoWeek(new Date(2026, 11, 31))).toBe("2026-W53");
  });

  it("round-trips with getDateRange so the picker default matches the server", () => {
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const days = [
      new Date(2026, 9, 17), // Sat 2026-10-17
      new Date(2026, 0, 5), // Mon 2026-01-05
      new Date(2026, 11, 27), // Tue 2026-12-27
      new Date(2027, 0, 1), // Fri 2027-01-01 (in 2026-W53)
    ];
    for (const day of days) {
      const week = currentIsoWeek(day);
      const range = getDateRange({ type: "weekly", week, now: day });
      expect(week).toMatch(/^\d{4}-W\d{2}$/);
      expect(range.start <= ymd(day)).toBe(true);
      expect(range.end >= ymd(day)).toBe(true);
    }
  });

  it("agrees with a hand-computed week for a mid-year date", () => {
    // Sat 2026-10-17 is in the Mon 2026-10-12 .. Sun 2026-10-18 week.
    expect(currentIsoWeek(new Date(2026, 9, 17))).toBe("2026-W42");
    expect(
      getDateRange({ type: "weekly", week: "2026-W42" })
    ).toEqual({ start: "2026-10-12", end: "2026-10-18" });
  });
});

describe("getDateRange — fallback", () => {
  it("treats an unknown type as daily", () => {
    expect(
      getDateRange({ type: "fortnightly", date: "2026-03-15" })
    ).toEqual({ start: "2026-03-15", end: "2026-03-15" });
  });
});
