/**
 * Shared API/data shapes.
 *
 * Single source of truth for the shapes exchanged between the API routes and
 * the client pages. These are the *real* runtime shapes: MongoDB stores ids as
 * numbers, so `id` / `ward_id` / `item_id` are `number` here — NOT strings.
 *
 * Previously each page re-declared these inline, and several declared ids as
 * `string` while the API actually returned numbers. TypeScript never caught it
 * because `fetch().json()` is `any`. Do not "fix" these back to strings.
 */

export const ORDER_TYPES = ["FS", "EMT", "AOH"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

/** GET /api/wards */
export interface Ward {
  id: number;
  name: string;
  category: string;
}

/** GET /api/items */
export interface Item {
  id: number;
  name: string;
  quick_rx_record: boolean;
}

/** An entry in a ward's catalog (GET /api/catalog/[wardId]). */
export interface CatalogItem {
  ward_id: number;
  item_id: number;
  item_name: string;
  quick_rx_record?: boolean;
  max_per_order: number;
  /** `null` means "no monthly quota". */
  monthly_quota: number | null;
  /** Only present when a `month` query param is supplied. */
  month_used?: number;
}

/** A line item as returned embedded in an order. */
export interface OrderItem {
  item_id: number;
  item_name: string;
  quantity: number;
  quick_rx_record?: boolean;
}

/** An order as returned by /api/orders (list and detail). */
export interface Order {
  id: number;
  ward_id: number;
  ward_name: string;
  order_date: string;
  order_number: string;
  order_type: OrderType | string;
  masa_pejabat: boolean;
  masa_diterima: string | null;
  sudah_disedia: boolean;
  completion_minutes: number | null;
  masa_selesai: string | null;
  items: OrderItem[];
  item_count?: number;
  created_at: string;
  updated_at?: string;
}

/** A quota-usage row on the dashboard. */
export interface ItemStatus {
  ward_name: string;
  item_name: string;
  quota: number;
  used: number;
}

/** GET /api/dashboard */
export interface DashboardData {
  month: string;
  itemStatus: ItemStatus[];
  warnings: ItemStatus[];
  exceeded: ItemStatus[];
  orders_count: number;
  items_count: number;
  top_ward: {
    ward_id: number;
    ward_name: string;
    order_count: number;
  } | null;
}

/**
 * Read-model row types for Mongo `.project()` results.
 *
 * The Mongo driver types `.project(...).toArray()` as `Document[]`, so every
 * downstream `.map`/`.filter` callback used to fall back to `any`. These
 * describe the shape each projection actually yields, so the callbacks can be
 * typed and the compiler checks the field access.
 */

/** A projected `orders` row (fields depend on the projection, all optional-ish). */
export interface OrderRow {
  id: number;
  ward_id: number;
  order_number: string;
  order_date: string;
  order_type: string;
  masa_pejabat: boolean;
  sudah_disedia: boolean;
  masa_diterima?: string | null;
  completion_minutes?: number | null;
  created_at?: string;
  masa_selesai?: string | null;
}

/** A projected `order_items` row. */
export interface OrderItemRow {
  order_id: number;
  item_id: number;
  quantity: number;
}

/** A projected `wards` row. */
export interface WardRow {
  id: number;
  name: string;
  category?: string;
}

/** A projected `items` row. */
export interface ItemRow {
  id: number;
  name: string;
  quick_rx_record?: boolean;
}
