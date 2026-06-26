import { MongoClient } from "mongodb";
import Database from "better-sqlite3";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });

const MONGODB_URI = process.env.MONGODB_URI!;
const SQLITE_PATH = resolve(__dirname, "../../bekalan/data/bekalan.sqlite");

interface WardRow { id: number; name: string; category: string; }
interface ItemRow { id: number; name: string; }
interface CatalogRow { ward_id: number; item_id: number; max_per_order: number; monthly_quota: number | null; }
interface OrderRow {
  id: number; ward_id: number; order_date: string; order_number: string;
  order_type: string; masa_pejabat: number; masa_diterima: string | null;
  sudah_disedia: number; completion_minutes: number | null; masa_selesai: string | null;
  created_at: string; updated_at: string;
}
interface OrderItemRow { order_id: number; item_id: number; quantity: number; }

async function migrate() {
  console.log("=== Bekalan Farmasi → MongoDB Migration ===\n");

  // Connect to SQLite
  console.log(`Reading SQLite database: ${SQLITE_PATH}`);
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  // Connect to MongoDB
  console.log("Connecting to MongoDB Atlas...");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db("bekalanipp");

  // Read all data from SQLite
  const wards = sqlite.prepare("SELECT * FROM wards").all() as WardRow[];
  const items = sqlite.prepare("SELECT * FROM items").all() as ItemRow[];
  const catalog = sqlite.prepare("SELECT * FROM ward_catalog").all() as CatalogRow[];
  const orders = sqlite.prepare("SELECT * FROM orders").all() as OrderRow[];
  const orderItems = sqlite.prepare("SELECT * FROM order_items").all() as OrderItemRow[];

  console.log(`\nSQLite data found:`);
  console.log(`  Wards: ${wards.length}`);
  console.log(`  Items: ${items.length}`);
  console.log(`  Catalog entries: ${catalog.length}`);
  console.log(`  Orders: ${orders.length}`);
  console.log(`  Order items: ${orderItems.length}`);

  // Drop existing collections (idempotent)
  const collections = ["wards", "items", "ward_catalog", "orders", "order_items", "counters"];
  for (const col of collections) {
    await db.collection(col).drop().catch(() => {});
  }
  console.log("\nDropped existing collections.");

  // Migrate wards
  if (wards.length > 0) {
    const docs = wards.map(w => ({
      id: w.id,
      name: w.name,
      category: w.category || "ward",
    }));
    await db.collection("wards").insertMany(docs);
    console.log(`  ✓ wards: ${docs.length} documents inserted`);
  }

  // Migrate items
  if (items.length > 0) {
    const docs = items.map(i => ({
      id: i.id,
      name: i.name,
    }));
    await db.collection("items").insertMany(docs);
    console.log(`  ✓ items: ${docs.length} documents inserted`);
  }

  // Migrate ward_catalog
  if (catalog.length > 0) {
    const docs = catalog.map(c => ({
      ward_id: c.ward_id,
      item_id: c.item_id,
      max_per_order: c.max_per_order,
      monthly_quota: c.monthly_quota,
    }));
    await db.collection("ward_catalog").insertMany(docs);
    console.log(`  ✓ ward_catalog: ${docs.length} documents inserted`);
  }

  // Migrate orders
  if (orders.length > 0) {
    const docs = orders.map(o => ({
      id: o.id,
      ward_id: o.ward_id,
      order_date: o.order_date,
      order_number: o.order_number,
      order_type: o.order_type,
      masa_pejabat: Boolean(o.masa_pejabat),
      masa_diterima: o.masa_diterima || null,
      sudah_disedia: Boolean(o.sudah_disedia),
      completion_minutes: o.completion_minutes,
      masa_selesai: o.masa_selesai || null,
      created_at: o.created_at,
      updated_at: o.updated_at,
    }));
    await db.collection("orders").insertMany(docs);
    console.log(`  ✓ orders: ${docs.length} documents inserted`);
  }

  // Migrate order_items
  if (orderItems.length > 0) {
    const docs = orderItems.map(oi => ({
      order_id: oi.order_id,
      item_id: oi.item_id,
      quantity: oi.quantity,
    }));
    await db.collection("order_items").insertMany(docs);
    console.log(`  ✓ order_items: ${docs.length} documents inserted`);
  }

  // Create indexes
  console.log("\nCreating indexes...");

  await db.collection("wards").createIndex({ name: 1 }, { unique: true });
  await db.collection("items").createIndex({ name: 1 }, { unique: true });
  await db.collection("ward_catalog").createIndex({ ward_id: 1, item_id: 1 }, { unique: true });
  await db.collection("orders").createIndex({ order_number: 1 }, { unique: true });
  await db.collection("orders").createIndex({ order_date: 1 });
  await db.collection("orders").createIndex({ ward_id: 1 });
  await db.collection("order_items").createIndex({ order_id: 1, item_id: 1 }, { unique: true });
  console.log("  ✓ All indexes created");

  // Create counters for auto-increment IDs
  const maxWardId = wards.length > 0 ? Math.max(...wards.map(w => w.id)) : 0;
  const maxItemId = items.length > 0 ? Math.max(...items.map(i => i.id)) : 0;
  const maxOrderId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) : 0;

  await db.collection("counters").insertMany([
    { _id: "wards", seq: maxWardId },
    { _id: "items", seq: maxItemId },
    { _id: "orders", seq: maxOrderId },
  ]);
  console.log(`  ✓ Counters initialized (wards: ${maxWardId}, items: ${maxItemId}, orders: ${maxOrderId})`);

  // Verify
  console.log("\n=== Verification ===");
  for (const col of collections) {
    const count = await db.collection(col).countDocuments();
    console.log(`  ${col}: ${count} documents`);
  }

  sqlite.close();
  await client.close();

  console.log("\nMigration complete!");
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
