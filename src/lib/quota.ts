/**
 * Quota validation rules — the single source of truth.
 *
 * These rules previously existed in three diverging copies:
 *   1. src/app/supply/page.tsx (client-side pre-submit validation)
 *   2. src/app/api/orders/route.ts (POST)
 *   3. src/app/api/orders/[id]/route.ts (PUT) — which, unlike POST, was
 *      missing the max-per-order check entirely.
 *
 * They also disagreed on the meaning of monthly_quota = 0: the client treated
 * it as "no quota", the server treated it as "reject every order". The rules
 * below settle that: 0 and negative quotas are treated as "no limit" (the
 * switch is off), consistent with how the catalog UI and dashboard render it
 * (both check `quota > 0`).
 */

export interface CatalogRule {
  /** 0 or negative = no per-order limit. */
  max_per_order: number;
  /** null / 0 / negative = no monthly quota. */
  monthly_quota: number | null;
}

export interface QuotaViolation {
  /** Which rule was breached. */
  rule: "max_per_order" | "monthly_quota";
  /** Configured limit that was exceeded. */
  limit: number;
  /** Quantity already used this month (monthly rule only). */
  monthUsed?: number;
}

/** The single per-order cap check. Returns a violation or null. */
export function checkMaxPerOrder(
  catalog: CatalogRule,
  quantity: number
): QuotaViolation | null {
  if (catalog.max_per_order > 0 && quantity > catalog.max_per_order) {
    return { rule: "max_per_order", limit: catalog.max_per_order };
  }
  return null;
}

/**
 * The monthly cap check. `monthUsed` is this ward+item's usage for the month
 * EXCLUDING the order being validated (the caller's job — for updates, the
 * order's own current lines must be subtracted first).
 */
export function checkMonthlyQuota(
  catalog: CatalogRule,
  quantity: number,
  monthUsed: number
): QuotaViolation | null {
  const quota = catalog.monthly_quota;
  // Only a strictly positive quota enforces anything (see file header).
  if (quota == null || quota <= 0) return null;
  if (monthUsed + quantity > quota) {
    return { rule: "monthly_quota", limit: quota, monthUsed };
  }
  return null;
}

/** Both checks, in cap-then-quota order. Returns the first violation or null. */
export function checkCatalogRules(
  catalog: CatalogRule,
  quantity: number,
  monthUsed: number
): QuotaViolation | null {
  return (
    checkMaxPerOrder(catalog, quantity) ??
    checkMonthlyQuota(catalog, quantity, monthUsed)
  );
}

/** Malay error message for a violation, given the item's display name. */
export function formatViolation(
  violation: QuotaViolation,
  itemName: string
): string {
  if (violation.rule === "max_per_order") {
    return `Kuantiti untuk "${itemName}" melebihi had setiap pesanan (maksimum: ${violation.limit}).`;
  }
  return `Kuota bulanan untuk "${itemName}" akan dilampaui. Kuota: ${violation.limit}, sudah digunakan: ${violation.monthUsed ?? 0}.`;
}
