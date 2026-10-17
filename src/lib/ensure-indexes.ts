import type { Db } from "mongodb";

/**
 * Single source of truth for the app's MongoDB indexes.
 *
 * Called by both scripts/migrate.ts and POST /api/admin/indexes so the two
 * can never drift apart again.
 *
 * Note: the unique compound index on order_items {order_id, item_id} is safe
 * because every order-items write goes through groupItems() (see
 * src/lib/order-utils.ts), which merges duplicate lines — an order can never
 * contain the same item twice.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("wards").createIndex({ id: 1 }, { unique: true }),
    db.collection("wards").createIndex({ name: 1 }, { unique: true }),
    db.collection("items").createIndex({ id: 1 }, { unique: true }),
    db.collection("items").createIndex({ name: 1 }, { unique: true }),
    db.collection("ward_catalog").createIndex(
      { ward_id: 1, item_id: 1 },
      { unique: true }
    ),
    db.collection("orders").createIndex({ id: 1 }, { unique: true }),
    db.collection("orders").createIndex({ order_number: 1 }, { unique: true }),
    db.collection("orders").createIndex({ order_date: 1 }),
    // Covers the records list sort ({order_date:-1, created_at:-1}); also a
    // superset of the old single-field {order_date:-1} index, so that one is
    // not created separately.
    db.collection("orders").createIndex({ order_date: -1, created_at: -1 }),
    db.collection("orders").createIndex({ ward_id: 1 }),
    // Serves the /api/orders/pending-count poll, which runs every 60s per
    // open tab.
    db.collection("orders").createIndex({ sudah_disedia: 1 }),
    db.collection("order_items").createIndex(
      { order_id: 1, item_id: 1 },
      { unique: true }
    ),
    db.collection("order_items").createIndex({ item_id: 1 }),
  ]);
}
