import { describe, expect, it } from "vitest";
import {
  checkCatalogRules,
  checkMaxPerOrder,
  checkMonthlyQuota,
  formatViolation,
  type CatalogRule,
} from "./quota";

describe("checkMaxPerOrder", () => {
  it("allows a quantity at the limit", () => {
    const cat: CatalogRule = { max_per_order: 10, monthly_quota: null };
    expect(checkMaxPerOrder(cat, 10)).toBeNull();
  });

  it("rejects a quantity one over the limit", () => {
    const cat: CatalogRule = { max_per_order: 10, monthly_quota: null };
    expect(checkMaxPerOrder(cat, 11)).toEqual({
      rule: "max_per_order",
      limit: 10,
    });
  });

  it("treats 0 as no per-order limit", () => {
    const cat: CatalogRule = { max_per_order: 0, monthly_quota: null };
    expect(checkMaxPerOrder(cat, 10_000)).toBeNull();
  });

  it("treats a negative limit as no per-order limit", () => {
    const cat: CatalogRule = { max_per_order: -1, monthly_quota: null };
    expect(checkMaxPerOrder(cat, 999)).toBeNull();
  });
});

describe("checkMonthlyQuota", () => {
  it("allows usage exactly at the quota", () => {
    const cat: CatalogRule = { max_per_order: 0, monthly_quota: 20 };
    expect(checkMonthlyQuota(cat, 5, 15)).toBeNull();
  });

  it("rejects usage that would exceed the quota", () => {
    const cat: CatalogRule = { max_per_order: 0, monthly_quota: 20 };
    expect(checkMonthlyQuota(cat, 6, 15)).toEqual({
      rule: "monthly_quota",
      limit: 20,
      monthUsed: 15,
    });
  });

  it("treats a null quota as unlimited", () => {
    const cat: CatalogRule = { max_per_order: 0, monthly_quota: null };
    expect(checkMonthlyQuota(cat, 500, 500)).toBeNull();
  });

  // Regression: the client treated 0 as "no quota" while the server treated
  // it as "reject every order". The shared rule settles on "no limit".
  it("treats a 0 quota as unlimited, not as reject-everything", () => {
    const cat: CatalogRule = { max_per_order: 0, monthly_quota: 0 };
    expect(checkMonthlyQuota(cat, 1, 0)).toBeNull();
  });

  it("treats a negative quota as unlimited", () => {
    const cat: CatalogRule = { max_per_order: 0, monthly_quota: -5 };
    expect(checkMonthlyQuota(cat, 1, 0)).toBeNull();
  });

  it("counts monthUsed correctly when the month is empty", () => {
    const cat: CatalogRule = { max_per_order: 0, monthly_quota: 10 };
    expect(checkMonthlyQuota(cat, 10, 0)).toBeNull();
    expect(checkMonthlyQuota(cat, 11, 0)).not.toBeNull();
  });
});

describe("checkCatalogRules", () => {
  it("reports max_per_order before monthly quota", () => {
    const cat: CatalogRule = { max_per_order: 2, monthly_quota: 5 };
    // Both would be breached; the per-order cap is checked first.
    const v = checkCatalogRules(cat, 10, 0);
    expect(v?.rule).toBe("max_per_order");
  });

  it("falls through to monthly quota when the cap is fine", () => {
    const cat: CatalogRule = { max_per_order: 100, monthly_quota: 5 };
    const v = checkCatalogRules(cat, 10, 0);
    expect(v?.rule).toBe("monthly_quota");
  });

  it("passes when neither rule is breached", () => {
    const cat: CatalogRule = { max_per_order: 10, monthly_quota: 20 };
    expect(checkCatalogRules(cat, 3, 5)).toBeNull();
  });
});

describe("formatViolation", () => {
  it("formats the per-order message", () => {
    const msg = formatViolation(
      { rule: "max_per_order", limit: 10 },
      "Panadol"
    );
    expect(msg).toContain("Panadol");
    expect(msg).toContain("10");
  });

  it("formats the monthly message including usage", () => {
    const msg = formatViolation(
      { rule: "monthly_quota", limit: 20, monthUsed: 15 },
      "Panadol"
    );
    expect(msg).toContain("Panadol");
    expect(msg).toContain("20");
    expect(msg).toContain("15");
  });
});
