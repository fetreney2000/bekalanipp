import { connectToDatabase } from "./mongodb";
import { ObjectId, Collection, Db, ClientSession } from "mongodb";

interface WardDoc {
  _id?: ObjectId;
  id: number;
  name: string;
  category: "ward" | "not_ward";
}

interface ItemDoc {
  _id?: ObjectId;
  id: number;
  name: string;
}

interface CatalogDoc {
  _id?: ObjectId;
  ward_id: number;
  item_id: number;
  max_per_order: number;
  monthly_quota: number | null;
}

interface OrderDoc {
  _id?: ObjectId;
  id: number;
  ward_id: number;
  order_date: string;
  order_number: string;
  order_type: "FS" | "EMT" | "AOH";
  masa_pejabat: boolean;
  masa_diterima: string | null;
  sudah_disedia: boolean;
  completion_minutes: number | null;
  masa_selesai: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderItemDoc {
  _id?: ObjectId;
  order_id: number;
  item_id: number;
  quantity: number;
}

interface CounterDoc {
  _id: string;
  seq: number;
}

function formatLocalDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthRangeFromDate(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = formatLocalDate(new Date(y, m, 1));
  const end = formatLocalDate(new Date(y, m + 1, 0));
  return { start, end };
}

function nowIso(): string {
  return new Date().toISOString();
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function buildQuotaNotifications({
  wardName,
  itemName,
  usedAfter,
  quota,
}: {
  wardName: string;
  itemName: string;
  usedAfter: number;
  quota: number;
}): { level: string; message: string } | null {
  const pct = quota > 0 ? (usedAfter / quota) * 100 : 0;
  if (pct >= 100) {
    return {
      level: "bad",
      message: `${wardName} telah HABIS kuota bulanan untuk ${itemName}. (${usedAfter}/${quota})`,
    };
  }
  if (pct >= 80) {
    return {
      level: "warn",
      message: `${wardName} telah guna ≥80% kuota bulanan untuk ${itemName}. (${usedAfter}/${quota})`,
    };
  }
  return null;
}

// ─── Counter utility ──────────────────────────────────────────────────────────

export async function getNextSequence(name: string): Promise<number> {
  const { db } = await connectToDatabase();
  const counters = db.collection<CounterDoc>("counters");
  const result = await counters.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return result!.seq;
}

// ─── Wards ────────────────────────────────────────────────────────────────────

export async function getAllWards(): Promise<
  { id: number; name: string; category: string }[]
> {
  const { db } = await connectToDatabase();
  const wards = db.collection<WardDoc>("wards");
  const rows = await wards.find({}).sort({ name: 1 }).toArray();
  return rows.map((r) => ({ id: r.id, name: r.name, category: r.category }));
}

export async function getWardById(
  id: number
): Promise<{ id: number; name: string; category: string } | null> {
  const { db } = await connectToDatabase();
  const wards = db.collection<WardDoc>("wards");
  const r = await wards.findOne({ id });
  if (!r) return null;
  return { id: r.id, name: r.name, category: r.category };
}

export async function createWard(
  name: string,
  category: string
): Promise<{ id: number; name: string; category: string }> {
  const { db } = await connectToDatabase();
  const wards = db.collection<WardDoc>("wards");

  const existing = await wards.findOne({ name });
  if (existing) {
    const err: any = new Error("Nama wad/jabatan sudah wujud.");
    err.status = 400;
    throw err;
  }

  const id = await getNextSequence("wards");
  const doc: WardDoc = { id, name, category: category as "ward" | "not_ward" };
  await wards.insertOne(doc);
  return { id, name, category };
}

export async function updateWard(
  id: number,
  name: string,
  category: string
): Promise<{ id: number; name: string; category: string } | null> {
  const { db } = await connectToDatabase();
  const wards = db.collection<WardDoc>("wards");

  const existing = await wards.findOne({ id });
  if (!existing) return null;

  const nameConflict = await wards.findOne({
    name,
    id: { $ne: id },
  });
  if (nameConflict) {
    const err: any = new Error("Nama wad/jabatan sudah wujud.");
    err.status = 400;
    throw err;
  }

  await wards.updateOne({ id }, { $set: { name, category: category as "ward" | "not_ward" } });
  return { id, name, category };
}

export async function deleteWard(id: number): Promise<boolean> {
  const { db } = await connectToDatabase();
  const wards = db.collection<WardDoc>("wards");
  const orders = db.collection<OrderDoc>("orders");

  const existing = await wards.findOne({ id });
  if (!existing) return false;

  const hasOrders = await orders.findOne({ ward_id: id });
  if (hasOrders) {
    const err: any = new Error(
      "Tidak boleh padam: wad/jabatan masih mempunyai rekod pesanan."
    );
    err.status = 400;
    throw err;
  }

  const result = await wards.deleteOne({ id });
  return result.deletedCount > 0;
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function getAllItems(): Promise<{ id: number; name: string }[]> {
  const { db } = await connectToDatabase();
  const items = db.collection<ItemDoc>("items");
  const rows = await items.find({}).sort({ name: 1 }).toArray();
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export async function getItemById(
  id: number
): Promise<{ id: number; name: string } | null> {
  const { db } = await connectToDatabase();
  const items = db.collection<ItemDoc>("items");
  const r = await items.findOne({ id });
  if (!r) return null;
  return { id: r.id, name: r.name };
}

export async function createItem(
  name: string
): Promise<{ id: number; name: string }> {
  const { db } = await connectToDatabase();
  const items = db.collection<ItemDoc>("items");

  const existing = await items.findOne({ name });
  if (existing) {
    const err: any = new Error("Nama item sudah wujud.");
    err.status = 400;
    throw err;
  }

  const id = await getNextSequence("items");
  await items.insertOne({ id, name });
  return { id, name };
}

export async function updateItem(
  id: number,
  name: string
): Promise<{ id: number; name: string } | null> {
  const { db } = await connectToDatabase();
  const items = db.collection<ItemDoc>("items");

  const existing = await items.findOne({ id });
  if (!existing) return null;

  const nameConflict = await items.findOne({ name, id: { $ne: id } });
  if (nameConflict) {
    const err: any = new Error("Nama item sudah wujud.");
    err.status = 400;
    throw err;
  }

  await items.updateOne({ id }, { $set: { name } });
  return { id, name };
}

export async function deleteItem(id: number): Promise<boolean> {
  const { db } = await connectToDatabase();
  const items = db.collection<ItemDoc>("items");
  const catalog = db.collection<CatalogDoc>("ward_catalog");
  const orderItems = db.collection<OrderItemDoc>("order_items");

  const existing = await items.findOne({ id });
  if (!existing) return false;

  const inCatalog = await catalog.findOne({ item_id: id });
  if (inCatalog) {
    const err: any = new Error(
      "Tidak boleh padam: item masih digunakan dalam pesanan atau katalog."
    );
    err.status = 400;
    throw err;
  }

  const inOrders = await orderItems.findOne({ item_id: id });
  if (inOrders) {
    const err: any = new Error(
      "Tidak boleh padam: item masih digunakan dalam pesanan atau katalog."
    );
    err.status = 400;
    throw err;
  }

  const result = await items.deleteOne({ id });
  return result.deletedCount > 0;
}

// ─── Ward Catalog ─────────────────────────────────────────────────────────────

export async function getCatalogForWard(
  wardId: number,
  month?: string
): Promise<{
  ward: { id: number; name: string } | null;
  items: {
    ward_id: number;
    item_id: number;
    item_name: string;
    max_per_order: number;
    monthly_quota: number | null;
    month_used?: number;
  }[];
}> {
  const { db } = await connectToDatabase();
  const wards = db.collection<WardDoc>("wards");
  const catalog = db.collection<CatalogDoc>("ward_catalog");
  const itemsCol = db.collection<ItemDoc>("items");
  const orders = db.collection<OrderDoc>("orders");
  const orderItems = db.collection<OrderItemDoc>("order_items");

  const ward = await wards.findOne({ id: wardId });
  if (!ward) {
    return { ward: null, items: [] };
  }

  const catRows = await catalog
    .aggregate([
      { $match: { ward_id: wardId } },
      {
        $lookup: {
          from: "items",
          localField: "item_id",
          foreignField: "id",
          as: "item_doc",
        },
      },
      { $unwind: { path: "$item_doc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          ward_id: 1,
          item_id: 1,
          item_name: "$item_doc.name",
          max_per_order: 1,
          monthly_quota: 1,
        },
      },
      { $sort: { item_name: 1 } },
    ])
    .toArray();

  let items: any[] = catRows;

  if (month) {
    const [y, m] = month.split("-").map((x) => Number(x));
    const startStr = formatLocalDate(new Date(y, m - 1, 1));
    const endStr = formatLocalDate(new Date(y, m, 0));

    const usageRows = await orderItems
      .aggregate([
        {
          $lookup: {
            from: "orders",
            localField: "order_id",
            foreignField: "id",
            as: "order_doc",
          },
        },
        { $unwind: { path: "$order_doc" } },
        {
          $match: {
            "order_doc.ward_id": wardId,
            "order_doc.order_date": { $gte: startStr, $lte: endStr },
          },
        },
        {
          $group: {
            _id: "$item_id",
            used: { $sum: "$quantity" },
          },
        },
      ])
      .toArray();

    const usageMap = new Map(
      usageRows.map((u: any) => [Number(u._id), Number(u.used || 0)])
    );
    items = catRows.map((it: any) => ({
      ...it,
      month_used: usageMap.get(it.item_id) || 0,
    }));
  }

  return {
    ward: { id: ward.id, name: ward.name },
    items,
  };
}

export async function upsertCatalogEntry(
  wardId: number,
  itemId: number,
  maxPerOrder: number,
  monthlyQuota: number | null
): Promise<void> {
  const { db } = await connectToDatabase();
  const catalog = db.collection<CatalogDoc>("ward_catalog");

  await catalog.updateOne(
    { ward_id: wardId, item_id: itemId },
    {
      $set: {
        ward_id: wardId,
        item_id: itemId,
        max_per_order: maxPerOrder,
        monthly_quota: monthlyQuota,
      },
    },
    { upsert: true }
  );
}

export async function updateCatalogEntry(
  wardId: number,
  itemId: number,
  maxPerOrder: number,
  monthlyQuota: number | null
): Promise<boolean> {
  const { db } = await connectToDatabase();
  const catalog = db.collection<CatalogDoc>("ward_catalog");

  const result = await catalog.updateOne(
    { ward_id: wardId, item_id: itemId },
    { $set: { max_per_order: maxPerOrder, monthly_quota: monthlyQuota } }
  );
  return result.matchedCount > 0;
}

export async function deleteCatalogEntry(
  wardId: number,
  itemId: number
): Promise<boolean> {
  const { db } = await connectToDatabase();
  const catalog = db.collection<CatalogDoc>("ward_catalog");

  const result = await catalog.deleteOne({ ward_id: wardId, item_id: itemId });
  return result.deletedCount > 0;
}

// ─── Internal helpers for orders ──────────────────────────────────────────────

async function getMonthlyUsageBulk(
  db: Db,
  wardId: number,
  itemIds: number[],
  start: string,
  end: string,
  excludeOrderId: number | null
): Promise<Map<number, number>> {
  if (!itemIds.length) return new Map();

  const matchStage: any = {
    ward_id: wardId,
    order_date: { $gte: start, $lte: end },
  };
  if (excludeOrderId !== null) {
    matchStage.id = { $ne: excludeOrderId };
  }

  const orderItemsCol = db.collection<OrderItemDoc>("order_items");
  const rows = await orderItemsCol
    .aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "order_id",
          foreignField: "id",
          as: "order_doc",
        },
      },
      { $unwind: { path: "$order_doc" } },
      {
        $match: {
          "order_doc.ward_id": wardId,
          "order_doc.order_date": { $gte: start, $lte: end },
          ...(excludeOrderId !== null
            ? { "order_doc.id": { $ne: excludeOrderId } }
            : {}),
          item_id: { $in: itemIds },
        },
      },
      {
        $group: {
          _id: "$item_id",
          used: { $sum: "$quantity" },
        },
      },
    ])
    .toArray();

  const map = new Map<number, number>();
  for (const id of itemIds) map.set(id, 0);
  for (const r of rows) map.set(Number(r._id), Number(r.used));
  return map;
}

async function validateAgainstCatalog(
  db: Db,
  wardId: number,
  items: { item_id: number; quantity: number }[]
): Promise<Map<string, CatalogDoc>> {
  const catalogCol = db.collection<CatalogDoc>("ward_catalog");
  const catRows = await catalogCol.find({ ward_id: wardId }).toArray();
  const cat = new Map(catRows.map((r) => [String(r.item_id), r]));

  const itemsCol = db.collection<ItemDoc>("items");
  for (const it of items) {
    const row = cat.get(String(it.item_id));
    if (!row) {
      const nameDoc = await itemsCol.findOne({ id: it.item_id });
      const label = nameDoc ? nameDoc.name : `ID ${it.item_id}`;
      const err: any = new Error(
        `Item tidak ada dalam katalog wad/jabatan: ${label}`
      );
      err.status = 400;
      throw err;
    }

    const max = Number(row.max_per_order);
    if (max > 0 && it.quantity > max) {
      const nameDoc = await itemsCol.findOne({ id: it.item_id });
      const label = nameDoc ? nameDoc.name : `ID ${it.item_id}`;
      const err: any = new Error(
        `Kuantiti melebihi maksimum setiap pesanan untuk ${label}. (Maks: ${max})`
      );
      err.status = 400;
      throw err;
    }
  }

  return cat;
}

function groupItems(
  items: { item_id: number; quantity: number }[]
): { item_id: number; quantity: number }[] {
  const map = new Map<number, number>();
  for (const it of items) {
    map.set(it.item_id, (map.get(it.item_id) || 0) + it.quantity);
  }
  return Array.from(map.entries()).map(([item_id, quantity]) => ({
    item_id,
    quantity,
  }));
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function getOrders(
  from?: string,
  to?: string
): Promise<any[]> {
  const { db } = await connectToDatabase();
  const ordersCol = db.collection<OrderDoc>("orders");
  const orderItemsCol = db.collection<OrderItemDoc>("order_items");
  const itemsCol = db.collection<ItemDoc>("items");

  const matchStage: any = {};
  if (from) matchStage.order_date = { ...(matchStage.order_date || {}), $gte: from };
  if (to) matchStage.order_date = { ...(matchStage.order_date || {}), $lte: to };

  const orderRows = await ordersCol
    .find(Object.keys(matchStage).length ? matchStage : {})
    .sort({ order_date: -1, id: -1 })
    .limit(500)
    .toArray();

  if (!orderRows.length) return [];

  const orderIds = orderRows.map((o) => o.id);

  const itemRows = await orderItemsCol
    .aggregate([
      { $match: { order_id: { $in: orderIds } } },
      {
        $lookup: {
          from: "items",
          localField: "item_id",
          foreignField: "id",
          as: "item_doc",
        },
      },
      { $unwind: { path: "$item_doc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          order_id: 1,
          item_id: 1,
          quantity: 1,
          item_name: "$item_doc.name",
        },
      },
      { $sort: { item_name: 1 } },
    ])
    .toArray();

  const byOrder = new Map<number, any[]>();
  for (const r of itemRows) {
    const key = Number(r.order_id);
    if (!byOrder.has(key)) byOrder.set(key, []);
    byOrder.get(key)!.push({
      item_id: r.item_id,
      item_name: r.item_name,
      quantity: r.quantity,
    });
  }

  const wardsCol = db.collection<WardDoc>("wards");
  const wardIds = Array.from(new Set(orderRows.map((o) => o.ward_id)));
  const wardDocs = await wardsCol.find({ id: { $in: wardIds } }).toArray();
  const wardMap = new Map(wardDocs.map((w) => [w.id, w.name]));

  return orderRows.map((o) => ({
    id: o.id,
    order_date: o.order_date,
    order_number: o.order_number,
    order_type: o.order_type,
    ward_id: o.ward_id,
    ward_name: wardMap.get(o.ward_id) || null,
    masa_pejabat: o.masa_pejabat,
    masa_diterima: o.masa_diterima,
    sudah_disedia: o.sudah_disedia,
    completion_minutes: o.completion_minutes,
    created_at: o.created_at,
    masa_selesai: o.masa_selesai,
    items: byOrder.get(o.id) || [],
    item_count: (byOrder.get(o.id) || []).length,
  }));
}

export async function getOrderById(id: number): Promise<any | null> {
  const { db } = await connectToDatabase();
  const ordersCol = db.collection<OrderDoc>("orders");
  const wardsCol = db.collection<WardDoc>("wards");
  const orderItemsCol = db.collection<OrderItemDoc>("order_items");

  const order = await ordersCol.findOne({ id });
  if (!order) return null;

  const ward = await wardsCol.findOne({ id: order.ward_id });

  const items = await orderItemsCol
    .aggregate([
      { $match: { order_id: id } },
      {
        $lookup: {
          from: "items",
          localField: "item_id",
          foreignField: "id",
          as: "item_doc",
        },
      },
      { $unwind: { path: "$item_doc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          item_id: 1,
          item_name: "$item_doc.name",
          quantity: 1,
        },
      },
      { $sort: { item_name: 1 } },
    ])
    .toArray();

  return {
    id: order.id,
    order_date: order.order_date,
    order_number: order.order_number,
    order_type: order.order_type,
    ward_id: order.ward_id,
    ward_name: ward ? ward.name : null,
    masa_pejabat: order.masa_pejabat,
    masa_diterima: order.masa_diterima,
    sudah_disedia: order.sudah_disedia,
    completion_minutes: order.completion_minutes,
    created_at: order.created_at,
    masa_selesai: order.masa_selesai,
    items,
  };
}

export async function checkOrderNumber(
  orderNumber: string,
  excludeId?: number
): Promise<{ exists: boolean }> {
  const { db } = await connectToDatabase();
  const ordersCol = db.collection<OrderDoc>("orders");

  const match: any = { order_number: orderNumber };
  if (excludeId !== undefined) {
    match.id = { $ne: excludeId };
  }

  const found = await ordersCol.findOne(match);
  return { exists: !!found };
}

export async function createOrder(data: {
  wardId: number;
  orderDate: string;
  orderNumber: string;
  orderType: string;
  masaPejabat: boolean;
  masaDiterima: string | null;
  sudahDisedia: boolean;
  items: { itemId: number; quantity: number }[];
}): Promise<{ id: number; notifications: any[] }> {
  const { db, client } = await connectToDatabase();
  const wardsCol = db.collection<WardDoc>("wards");
  const ordersCol = db.collection<OrderDoc>("orders");
  const orderItemsCol = db.collection<OrderItemDoc>("order_items");
  const itemsCol = db.collection<ItemDoc>("items");

  const ward = await wardsCol.findOne({ id: data.wardId });
  if (!ward) {
    const err: any = new Error("Wad/jabatan tidak dijumpai.");
    err.status = 404;
    throw err;
  }

  const grouped = groupItems(
    data.items.map((it) => ({ item_id: it.itemId, quantity: it.quantity }))
  );

  const cat = await validateAgainstCatalog(db, data.wardId, grouped);

  const { start, end } = monthRangeFromDate(data.orderDate);

  const itemIds = grouped.map((it) => it.item_id);
  const usedMap = await getMonthlyUsageBulk(
    db,
    data.wardId,
    itemIds,
    start,
    end,
    null
  );

  const notifications: any[] = [];
  const orderId = await getNextSequence("orders");
  const ts = nowIso();

  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await ordersCol.insertOne(
        {
          id: orderId,
          ward_id: data.wardId,
          order_date: data.orderDate,
          order_number: data.orderNumber,
          order_type: data.orderType as "FS" | "EMT" | "AOH",
          masa_pejabat: data.masaPejabat,
          masa_diterima: data.masaDiterima,
          sudah_disedia: data.sudahDisedia,
          completion_minutes: null,
          masa_selesai: null,
          created_at: ts,
          updated_at: ts,
        },
        { session }
      );

      const itemDocs: OrderItemDoc[] = [];
      for (const it of grouped) {
        const row = cat.get(String(it.item_id));
        const quota = row ? row.monthly_quota : null;
        if (quota != null) {
          const usedBefore = Number(usedMap.get(it.item_id) || 0);
          const usedAfter = usedBefore + it.quantity;

          if (usedAfter > Number(quota)) {
            const nameDoc = await itemsCol.findOne({ id: it.item_id });
            const itemName = nameDoc ? nameDoc.name : `ID ${it.item_id}`;
            const err: any = new Error(
              `Kuantiti melebihi baki kuota bulanan untuk ${itemName}. (Baki: ${Math.max(0, Number(quota) - usedBefore)})`
            );
            err.status = 400;
            throw err;
          }

          const nameDoc = await itemsCol.findOne({ id: it.item_id });
          const itemName = nameDoc ? nameDoc.name : `ID ${it.item_id}`;
          const n = buildQuotaNotifications({
            wardName: ward.name,
            itemName,
            usedAfter,
            quota,
          });

          const beforePct = quota > 0 ? (usedBefore / quota) * 100 : 0;
          const afterPct = quota > 0 ? (usedAfter / quota) * 100 : 0;
          if (
            (beforePct < 80 && afterPct >= 80) ||
            (beforePct < 100 && afterPct >= 100)
          ) {
            if (n) notifications.push(n);
          }
        }

        itemDocs.push({
          order_id: orderId,
          item_id: it.item_id,
          quantity: it.quantity,
        });
      }

      if (itemDocs.length) {
        await orderItemsCol.insertMany(itemDocs, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  return { id: orderId, notifications };
}

export async function updateOrder(
  id: number,
  data: {
    wardId?: number;
    orderDate: string;
    orderNumber: string;
    orderType: string;
    masaPejabat?: boolean;
    masaDiterima?: string | null;
    sudahDisedia?: boolean;
    items: { itemId: number; quantity: number }[];
  }
): Promise<{ notifications: any[] }> {
  const { db, client } = await connectToDatabase();
  const ordersCol = db.collection<OrderDoc>("orders");
  const orderItemsCol = db.collection<OrderItemDoc>("order_items");
  const wardsCol = db.collection<WardDoc>("wards");
  const itemsCol = db.collection<ItemDoc>("items");

  const existing = await ordersCol.findOne({ id });
  if (!existing) {
    const err: any = new Error("Pesanan tidak dijumpai.");
    err.status = 404;
    throw err;
  }

  const wardId = data.wardId ?? existing.ward_id;
  const ward = await wardsCol.findOne({ id: wardId });
  const grouped = groupItems(
    data.items.map((it) => ({ item_id: it.itemId, quantity: it.quantity }))
  );

  const cat = await validateAgainstCatalog(db, wardId, grouped);

  const { start, end } = monthRangeFromDate(data.orderDate);
  const itemIds = grouped.map((it) => it.item_id);
  const usedMap = await getMonthlyUsageBulk(
    db,
    wardId,
    itemIds,
    start,
    end,
    id
  );

  const notifications: any[] = [];
  const ts = nowIso();

  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const masaPejabat =
        typeof data.masaPejabat === "boolean"
          ? data.masaPejabat
          : existing.masa_pejabat;
      const masaDiterima =
        typeof data.masaDiterima === "string"
          ? data.masaDiterima
          : existing.masa_diterima;
      const sudahDisedia =
        typeof data.sudahDisedia === "boolean"
          ? data.sudahDisedia
          : existing.sudah_disedia;

      const updateResult = await ordersCol.updateOne(
        { id },
        {
          $set: {
            order_date: data.orderDate,
            order_number: data.orderNumber,
            order_type: data.orderType as "FS" | "EMT" | "AOH",
            masa_pejabat: masaPejabat,
            masa_diterima: masaDiterima,
            sudah_disedia: sudahDisedia,
            updated_at: ts,
          },
        },
        { session }
      );

      if (updateResult.matchedCount === 0) {
        const err: any = new Error("Pesanan tidak dijumpai.");
        err.status = 404;
        throw err;
      }

      await orderItemsCol.deleteMany({ order_id: id }, { session });

      const itemDocs: OrderItemDoc[] = [];
      for (const it of grouped) {
        const row = cat.get(String(it.item_id));
        const quota = row ? row.monthly_quota : null;
        if (quota != null) {
          const usedBefore = Number(usedMap.get(it.item_id) || 0);
          const usedAfter = usedBefore + it.quantity;
          if (usedAfter > Number(quota)) {
            const nameDoc = await itemsCol.findOne({ id: it.item_id });
            const itemName = nameDoc ? nameDoc.name : `ID ${it.item_id}`;
            const err: any = new Error(
              `Kuantiti melebihi baki kuota bulanan untuk ${itemName}. (Baki: ${Math.max(0, Number(quota) - usedBefore)})`
            );
            err.status = 400;
            throw err;
          }
        }

        itemDocs.push({
          order_id: id,
          item_id: it.item_id,
          quantity: it.quantity,
        });
      }

      if (itemDocs.length) {
        await orderItemsCol.insertMany(itemDocs, { session });
      }

      for (const it of grouped) {
        const row = cat.get(String(it.item_id));
        const quota = row ? row.monthly_quota : null;
        if (quota != null) {
          const usedBefore = Number(usedMap.get(it.item_id) || 0);
          const usedAfter = usedBefore + it.quantity;

          const nameDoc = await itemsCol.findOne({ id: it.item_id });
          const itemName = nameDoc ? nameDoc.name : `ID ${it.item_id}`;
          const n = buildQuotaNotifications({
            wardName: ward ? ward.name : "",
            itemName,
            usedAfter,
            quota,
          });

          const beforePct = quota > 0 ? (usedBefore / quota) * 100 : 0;
          const afterPct = quota > 0 ? (usedAfter / quota) * 100 : 0;
          if (
            (beforePct < 80 && afterPct >= 80) ||
            (beforePct < 100 && afterPct >= 100)
          ) {
            if (n) notifications.push(n);
          }
        }
      }
    });
  } finally {
    await session.endSession();
  }

  return { notifications };
}

export async function setOrderReady(
  id: number,
  sudahDisedia: boolean
): Promise<{
  id: number;
  sudah_disedia: boolean;
  completion_minutes: number | null;
  masa_selesai: string | null;
} | null> {
  const { db } = await connectToDatabase();
  const ordersCol = db.collection<OrderDoc>("orders");

  const row = await ordersCol.findOne({ id });
  if (!row) return null;

  let completionMinutes: number | null = null;
  let masaSelesai: string | null = null;

  if (sudahDisedia) {
    const created = new Date(row.created_at);
    const nowMs = Date.now();
    const diffMs = nowMs - created.getTime();
    completionMinutes = Math.max(0, Math.round(diffMs / 60000));
    masaSelesai = nowIso();
  }

  await ordersCol.updateOne(
    { id },
    {
      $set: {
        sudah_disedia: sudahDisedia,
        completion_minutes: completionMinutes,
        masa_selesai: masaSelesai,
        updated_at: nowIso(),
      },
    }
  );

  return {
    id,
    sudah_disedia: sudahDisedia,
    completion_minutes: completionMinutes,
    masa_selesai: masaSelesai,
  };
}

export async function setOrderMasaPejabat(
  id: number,
  masaPejabat: boolean
): Promise<boolean> {
  const { db } = await connectToDatabase();
  const ordersCol = db.collection<OrderDoc>("orders");

  const result = await ordersCol.updateOne(
    { id },
    { $set: { masa_pejabat: masaPejabat, updated_at: nowIso() } }
  );
  return result.matchedCount > 0;
}

export async function deleteOrder(id: number): Promise<boolean> {
  const { db } = await connectToDatabase();
  const ordersCol = db.collection<OrderDoc>("orders");
  const orderItemsCol = db.collection<OrderItemDoc>("order_items");

  const result = await ordersCol.deleteOne({ id });
  if (result.deletedCount === 0) return false;

  await orderItemsCol.deleteMany({ order_id: id });
  return true;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboard(month: string): Promise<{
  month: string;
  itemStatus: any[];
  warnings: any[];
  exceeded: any[];
  orders_count: number;
  items_count: number;
  top_ward: any;
}> {
  const { db } = await connectToDatabase();
  const ordersCol = db.collection<OrderDoc>("orders");
  const wardsCol = db.collection<WardDoc>("wards");

  const [y, m] = month.split("-").map((x) => Number(x));
  const startStr = formatLocalDate(new Date(y, m - 1, 1));
  const endStr = formatLocalDate(new Date(y, m, 0));

  const orderItemsCol = db.collection<OrderItemDoc>("order_items");
  const catalogCol = db.collection<CatalogDoc>("ward_catalog");

  const itemStatus = await catalogCol
    .aggregate([
      { $match: { monthly_quota: { $ne: null } } },
      {
        $lookup: {
          from: "wards",
          localField: "ward_id",
          foreignField: "id",
          as: "ward_doc",
        },
      },
      { $unwind: { path: "$ward_doc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "items",
          localField: "item_id",
          foreignField: "id",
          as: "item_doc",
        },
      },
      { $unwind: { path: "$item_doc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "orders",
          let: { wid: "$ward_id", iid: "$item_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$ward_id", "$$wid"] },
                    { $gte: ["$order_date", startStr] },
                    { $lte: ["$order_date", endStr] },
                  ],
                },
              },
            },
          ],
          as: "ord_docs",
        },
      },
      { $unwind: { path: "$ord_docs", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "order_items",
          let: { oid: "$ord_docs.id", iid: "$item_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$order_id", "$$oid"] },
                    { $eq: ["$item_id", "$$iid"] },
                  ],
                },
              },
            },
          ],
          as: "oi_docs",
        },
      },
      { $unwind: { path: "$oi_docs", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { ward_id: "$ward_id", item_id: "$item_id" },
          ward_name: { $first: "$ward_doc.name" },
          item_name: { $first: "$item_doc.name" },
          quota: { $first: "$monthly_quota" },
          used: { $sum: "$oi_docs.quantity" },
        },
      },
      {
        $project: {
          _id: 0,
          ward_name: 1,
          item_name: 1,
          quota: 1,
          used: { $ifNull: ["$used", 0] },
        },
      },
      { $sort: { ward_name: 1, item_name: 1 } },
    ])
    .toArray();

  const itemStatusFormatted = itemStatus.map((r: any) => ({
    ...r,
    used: Number(r.used || 0),
    quota: Number(r.quota || 0),
  }));

  const ordersCountRow = await ordersCol.aggregate([
    { $match: { order_date: { $gte: startStr, $lte: endStr } } },
    { $count: "cnt" },
  ]).toArray();
  const orders_count = Number(
    (ordersCountRow[0] as any)?.cnt || 0
  );

  const itemsCountRow = await orderItemsCol.aggregate([
    {
      $lookup: {
        from: "orders",
        localField: "order_id",
        foreignField: "id",
        as: "order_doc",
      },
    },
    { $unwind: { path: "$order_doc" } },
    {
      $match: {
        "order_doc.order_date": { $gte: startStr, $lte: endStr },
      },
    },
    { $group: { _id: "$item_id" } },
    { $count: "cnt" },
  ]).toArray();
  const items_count = Number((itemsCountRow[0] as any)?.cnt || 0);

  const topWardRow = await ordersCol.aggregate([
    { $match: { order_date: { $gte: startStr, $lte: endStr } } },
    { $group: { _id: "$ward_id", order_count: { $sum: 1 } } },
    { $sort: { order_count: -1 } },
    { $limit: 1 },
    {
      $lookup: {
        from: "wards",
        localField: "_id",
        foreignField: "id",
        as: "ward_doc",
      },
    },
    { $unwind: { path: "$ward_doc", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        ward_id: "$_id",
        ward_name: "$ward_doc.name",
        order_count: 1,
      },
    },
  ]).toArray();

  const top_ward = topWardRow.length
    ? {
        ward_id: topWardRow[0].ward_id,
        ward_name: topWardRow[0].ward_name,
        order_count: Number(topWardRow[0].order_count || 0),
      }
    : null;

  const exceeded = itemStatusFormatted.filter(
    (s: any) => s.quota > 0 && s.used >= s.quota
  );
  const warnings = itemStatusFormatted.filter(
    (s: any) => s.quota > 0 && s.used >= s.quota * 0.8 && s.used < s.quota
  );

  return {
    month,
    itemStatus: itemStatusFormatted,
    warnings,
    exceeded,
    orders_count,
    items_count,
    top_ward,
  };
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function getUsageReport(
  type: string,
  startStr: string,
  endStr: string
): Promise<{
  summary: any[];
  totals_by_ward: any[];
  totals: any;
  totals_by_masa: any;
  totals_by_masa_by_cat: any;
  recommendations: any[];
}> {
  const { db } = await connectToDatabase();
  const ordersCol = db.collection<OrderDoc>("orders");
  const orderItemsCol = db.collection<OrderItemDoc>("order_items");

  const summary = await ordersCol
    .aggregate([
      {
        $match: {
          order_date: { $gte: startStr, $lte: endStr },
        },
      },
      {
        $lookup: {
          from: "wards",
          localField: "ward_id",
          foreignField: "id",
          as: "ward_doc",
        },
      },
      { $unwind: { path: "$ward_doc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "order_items",
          localField: "id",
          foreignField: "order_id",
          as: "oi_docs",
        },
      },
      { $unwind: { path: "$oi_docs", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { ward_id: "$ward_id", order_type: "$order_type" },
          ward_name: { $first: "$ward_doc.name" },
          order_count: { $addToSet: "$id" },
          bil_item: { $sum: { $cond: [{ $ifNull: ["$oi_docs", false] }, 1, 0] } },
          jumlah_item: { $sum: { $ifNull: ["$oi_docs.quantity", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          ward_id: "$_id.ward_id",
          ward_name: 1,
          order_type: "$_id.order_type",
          order_count: { $size: "$order_count" },
          bil_item: 1,
          jumlah_item: 1,
        },
      },
      { $sort: { ward_name: 1, order_type: 1 } },
    ])
    .toArray();

  const totalsByWardMap = new Map<number, any>();
  for (const s of summary) {
    const k = Number(s.ward_id);
    if (!totalsByWardMap.has(k)) {
      totalsByWardMap.set(k, {
        ward_id: s.ward_id,
        ward_name: s.ward_name,
        order_count: 0,
        bil_item: 0,
        jumlah_item: 0,
      });
    }
    const t = totalsByWardMap.get(k)!;
    t.order_count += s.order_count;
    t.bil_item += s.bil_item;
    t.jumlah_item += s.jumlah_item;
  }

  const totals_by_ward = Array.from(totalsByWardMap.values());

  const totals = totals_by_ward.reduce(
    (acc, cur) => {
      acc.order_count += cur.order_count;
      acc.bil_item += cur.bil_item;
      acc.jumlah_item += cur.jumlah_item;
      return acc;
    },
    { order_count: 0, bil_item: 0, jumlah_item: 0 }
  );

  const masaRows = await ordersCol
    .aggregate([
      {
        $match: {
          order_date: { $gte: startStr, $lte: endStr },
        },
      },
      {
        $lookup: {
          from: "order_items",
          localField: "id",
          foreignField: "order_id",
          as: "oi_docs",
        },
      },
      { $unwind: { path: "$oi_docs", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$masa_pejabat",
          order_count: { $addToSet: "$id" },
          bil_item: { $sum: { $cond: [{ $ifNull: ["$oi_docs", false] }, 1, 0] } },
          jumlah_item: { $sum: { $ifNull: ["$oi_docs.quantity", 0] } },
        },
      },
      {
        $project: {
          masa: "$_id",
          order_count: { $size: "$order_count" },
          bil_item: 1,
          jumlah_item: 1,
          _id: 0,
        },
      },
    ])
    .toArray();

  const totals_by_masa: any = {
    masa_pejabat: { order_count: 0, bil_item: 0, jumlah_item: 0 },
    selepas_masa_pejabat: { order_count: 0, bil_item: 0, jumlah_item: 0 },
  };
  for (const r of masaRows) {
    const key = r.masa === true || r.masa === 1 ? "masa_pejabat" : "selepas_masa_pejabat";
    totals_by_masa[key] = {
      order_count: Number(r.order_count || 0),
      bil_item: Number(r.bil_item || 0),
      jumlah_item: Number(r.jumlah_item || 0),
    };
  }

  const masaCatRows = await ordersCol
    .aggregate([
      {
        $match: {
          order_date: { $gte: startStr, $lte: endStr },
        },
      },
      {
        $lookup: {
          from: "wards",
          localField: "ward_id",
          foreignField: "id",
          as: "ward_doc",
        },
      },
      { $unwind: { path: "$ward_doc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "order_items",
          localField: "id",
          foreignField: "order_id",
          as: "oi_docs",
        },
      },
      { $unwind: { path: "$oi_docs", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { category: "$ward_doc.category", masa: "$masa_pejabat" },
          order_count: { $addToSet: "$id" },
          bil_item: { $sum: { $cond: [{ $ifNull: ["$oi_docs", false] }, 1, 0] } },
          jumlah_item: { $sum: { $ifNull: ["$oi_docs.quantity", 0] } },
        },
      },
      {
        $project: {
          category: "$_id.category",
          masa: "$_id.masa",
          order_count: { $size: "$order_count" },
          bil_item: 1,
          jumlah_item: 1,
          _id: 0,
        },
      },
    ])
    .toArray();

  const zeroStats = { order_count: 0, bil_item: 0, jumlah_item: 0 };
  const totals_by_masa_by_cat: any = {
    ward: { masa_pejabat: { ...zeroStats }, selepas_masa_pejabat: { ...zeroStats } },
    not_ward: { masa_pejabat: { ...zeroStats }, selepas_masa_pejabat: { ...zeroStats } },
  };

  for (const r of masaCatRows) {
    const cat = r.category === "not_ward" ? "not_ward" : "ward";
    const masaKey =
      r.masa === true || r.masa === 1 ? "masa_pejabat" : "selepas_masa_pejabat";
    totals_by_masa_by_cat[cat][masaKey] = {
      order_count: Number(r.order_count || 0),
      bil_item: Number(r.bil_item || 0),
      jumlah_item: Number(r.jumlah_item || 0),
    };
  }

  const catalogCol = db.collection<CatalogDoc>("ward_catalog");
  const monthlyUsage = await catalogCol
    .aggregate([
      { $match: { monthly_quota: { $ne: null } } },
      {
        $lookup: {
          from: "wards",
          localField: "ward_id",
          foreignField: "id",
          as: "ward_doc",
        },
      },
      { $unwind: { path: "$ward_doc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "items",
          localField: "item_id",
          foreignField: "id",
          as: "item_doc",
        },
      },
      { $unwind: { path: "$item_doc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "orders",
          let: { wid: "$ward_id", iid: "$item_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$ward_id", "$$wid"] },
                  ],
                },
              },
            },
          ],
          as: "ord_docs",
        },
      },
      { $unwind: { path: "$ord_docs", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "order_items",
          let: { oid: "$ord_docs.id", iid: "$item_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$order_id", "$$oid"] },
                    { $eq: ["$item_id", "$$iid"] },
                  ],
                },
              },
            },
          ],
          as: "oi_docs",
        },
      },
      { $unwind: { path: "$oi_docs", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          ym: { $substr: ["$ord_docs.order_date", 0, 7] },
        },
      },
      {
        $group: {
          _id: {
            ward_id: "$ward_id",
            item_id: "$item_id",
            ym: "$ym",
          },
          ward_name: { $first: "$ward_doc.name" },
          item_name: { $first: "$item_doc.name" },
          current_quota: { $first: "$monthly_quota" },
          qty: { $sum: "$oi_docs.quantity" },
        },
      },
      {
        $project: {
          _id: 0,
          ward_name: 1,
          item_name: 1,
          current_quota: 1,
          qty: 1,
          ym: "$_id.ym",
          ward_id: "$_id.ward_id",
          item_id: "$_id.item_id",
        },
      },
    ])
    .toArray();

  const byWardItem = new Map<
    string,
    {
      ward_name: string;
      item_name: string;
      current_quota: number;
      values: number[];
    }
  >();
  for (const r of monthlyUsage) {
    const key = `${r.ward_id}:${r.item_id}`;
    if (!byWardItem.has(key)) {
      byWardItem.set(key, {
        ward_name: r.ward_name,
        item_name: r.item_name,
        current_quota: Number(r.current_quota || 0),
        values: [],
      });
    }
    byWardItem.get(key)!.values.push(Number(r.qty || 0));
  }

  const recommendations: any[] = [];
  for (const x of Array.from(byWardItem.values())) {
    if (x.values.length < 1) continue;

    const current = x.current_quota;
    if (!Number.isFinite(current) || current <= 0) continue;

    const m = mean(x.values);
    const target = Math.max(1, Math.ceil(m * 1.25));
    const delta = target - current;

    let recommendation = "Kekalkan kuota.";
    if (delta > 0)
      recommendation = `Naikkan kuota +${delta} (cadangan: ${target}).`;
    if (delta < 0)
      recommendation = `Turunkan kuota ${delta} (cadangan: ${target}).`;

    recommendations.push({
      ward_name: x.ward_name,
      item_name: x.item_name,
      current_quota: current,
      mean_monthly: m,
      recommendation,
      recommended_quota: target,
      delta,
    });
  }

  recommendations.sort((a, b) =>
    (a.ward_name + a.item_name).localeCompare(b.ward_name + b.item_name)
  );

  return {
    summary,
    totals_by_ward,
    totals,
    totals_by_masa,
    totals_by_masa_by_cat,
    recommendations,
  };
}

export async function getWardItemsReport(
  type: string,
  startStr: string,
  endStr: string,
  wardId?: number
): Promise<{
  items: { item_id: number; item_name: string; order_count: number; quantity_sum: number }[];
}> {
  const { db } = await connectToDatabase();
  const orderItemsCol = db.collection<OrderItemDoc>("order_items");
  const ordersCol = db.collection<OrderDoc>("orders");

  const matchStage: any = {
    order_date: { $gte: startStr, $lte: endStr },
  };
  if (wardId) matchStage.ward_id = wardId;

  const rows = await ordersCol
    .aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "order_items",
          localField: "id",
          foreignField: "order_id",
          as: "oi_docs",
        },
      },
      { $unwind: { path: "$oi_docs" } },
      {
        $lookup: {
          from: "items",
          localField: "oi_docs.item_id",
          foreignField: "id",
          as: "item_doc",
        },
      },
      { $unwind: { path: "$item_doc", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$oi_docs.item_id",
          item_name: { $first: "$item_doc.name" },
          order_ids: { $addToSet: "$id" },
          quantity_sum: { $sum: "$oi_docs.quantity" },
        },
      },
      {
        $project: {
          _id: 0,
          item_id: "$_id",
          item_name: 1,
          order_count: { $size: "$order_ids" },
          quantity_sum: 1,
        },
      },
      { $sort: { item_name: 1 } },
    ])
    .toArray();

  const items = rows.map((r: any) => ({
    item_id: r.item_id,
    item_name: r.item_name,
    order_count: Number(r.order_count || 0),
    quantity_sum: Number(r.quantity_sum || 0),
  }));

  return { items };
}
