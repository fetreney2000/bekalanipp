import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { groupItems, statusError, isDuplicateKeyError } from "@/lib/order-utils";
import { checkMaxPerOrder, checkMonthlyQuota, formatViolation } from "@/lib/quota";
import { ORDER_TYPES } from "@/lib/types";
import type { ItemRow, OrderItemRow, OrderRow, WardRow } from "@/lib/types";
import { getMonthRange, isValidDate } from "@/lib/date-range";
import { z } from "zod";

type CounterDoc = { _id: string; seq: number };
type CatalogDoc = { item_id: number; max_per_order: number; monthly_quota: number | null };
type ItemDoc = { id: number; name: string };

const orderItemSchema = z.object({
  item_id: z.number().int(),
  quantity: z.number().int().min(1),
});

const orderCreateSchema = z.object({
  ward_id: z.number().int(),
  order_date: z
    .string()
    .refine(isValidDate, { message: "Tarikh mesti berformat YYYY-MM-DD" }),
  order_number: z.string().min(1),
  order_type: z.enum(ORDER_TYPES),
  masa_pejabat: z.boolean().optional().default(false),
  masa_diterima: z.string().nullable().optional().default(null),
  sudah_disedia: z.boolean().optional().default(false),
  items: z.array(orderItemSchema).min(1, "Sekurang-kurangnya satu item diperlukan"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(600, Math.max(1, Number(searchParams.get("pageSize")) || 50));

    const { db } = await connectToDatabase();

    const filter: Record<string, unknown> = {};
    if (from || to) {
      const dateFilter: Record<string, string> = {};
      if (from) dateFilter.$gte = from;
      if (to) dateFilter.$lte = to;
      filter.order_date = dateFilter;
    }

    const skip = (page - 1) * pageSize;

    const [orders, total] = await Promise.all([
      (db
        .collection("orders")
        .find(filter)
        .project({ _id: 0, id: 1, ward_id: 1, order_date: 1, order_number: 1, order_type: 1, masa_pejabat: 1, masa_diterima: 1, sudah_disedia: 1, completion_minutes: 1, masa_selesai: 1, created_at: 1 })
        .sort({ order_date: -1, created_at: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray()) as Promise<OrderRow[]>,
      db.collection("orders").countDocuments(
        Object.keys(filter).length ? filter : {}
      ),
    ]);

    const orderIds = orders.map((o) => o.id);
    const wardIds = [...new Set(orders.map((o) => Number(o.ward_id)).filter(Boolean))];

    const [allOrderItems, allWards] = await Promise.all([
      orderIds.length > 0
        ? (db.collection("order_items").find({ order_id: { $in: orderIds } }).project({ _id: 0, order_id: 1, item_id: 1, quantity: 1 }).toArray() as Promise<OrderItemRow[]>)
        : Promise.resolve([] as OrderItemRow[]),
      wardIds.length > 0
        ? (db.collection("wards").find({ id: { $in: wardIds } }).project({ _id: 0, id: 1, name: 1 }).toArray() as Promise<WardRow[]>)
        : Promise.resolve([] as WardRow[]),
    ]);

    const wardMap = new Map(allWards.map((w) => [w.id, w.name]));

    const uniqueItemIds = [...new Set(allOrderItems.map((oi) => oi.item_id).filter(Boolean))];
    const allItems = uniqueItemIds.length > 0
      ? ((await db.collection("items").find({ id: { $in: uniqueItemIds } }).project({ _id: 0, id: 1, name: 1, quick_rx_record: 1 }).toArray()) as ItemRow[])
      : [];
    const itemMap = new Map(allItems.map((i) => [i.id, i.name]));
    const itemQuickRxMap = new Map(allItems.map((i) => [i.id, !!i.quick_rx_record]));

    const orderItemsByOrder = new Map<number, OrderItemRow[]>();
    for (const oi of allOrderItems) {
      const oid = oi.order_id;
      if (!orderItemsByOrder.has(oid)) orderItemsByOrder.set(oid, []);
      orderItemsByOrder.get(oid)!.push(oi);
    }

    const enrichedOrders = orders.map((order) => {
      const wardName = wardMap.get(Number(order.ward_id)) || "Unknown";
      const orderItemsDocs = orderItemsByOrder.get(order.id) || [];
      const enrichedItems = orderItemsDocs.map((item) => ({
        item_id: item.item_id,
        item_name: itemMap.get(item.item_id) || "Unknown",
        quantity: item.quantity,
        quick_rx_record: itemQuickRxMap.get(item.item_id) || false,
      }));
      return {
        id: order.id,
        ward_id: order.ward_id,
        ward_name: wardName,
        order_date: order.order_date,
        order_number: order.order_number,
        order_type: order.order_type,
        masa_pejabat: order.masa_pejabat || false,
        masa_diterima: order.masa_diterima || null,
        sudah_disedia: order.sudah_disedia || false,
        completion_minutes: order.completion_minutes || null,
        masa_selesai: order.masa_selesai || null,
        items: enrichedItems,
        item_count: enrichedItems.length,
        created_at: order.created_at,
      };
    });

    return NextResponse.json(
      { orders: enrichedOrders, total, page, pageSize },
      { headers: { "Cache-Control": "no-cache" } }
    );
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan senarai pesanan." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = orderCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const { db, client } = await connectToDatabase();

    const ward = await db.collection("wards").findOne({ id: Number(data.ward_id) });
    if (!ward) {
      return NextResponse.json(
        { error: "Wad/jabatan tidak ditemui" },
        { status: 400 }
      );
    }

    const existingOrder = await db
      .collection("orders")
      .findOne({ order_number: data.order_number });
    if (existingOrder) {
      return NextResponse.json(
        { error: "Nombor pesanan sudah wujud." },
        { status: 400 }
      );
    }

    // Merge duplicate lines so limits are enforced against the true total.
    const items = groupItems(data.items);
    const itemIds = items.map((i) => i.item_id);

    const [catalogEntries, itemDocs] = await Promise.all([
      db.collection<CatalogDoc>("ward_catalog").find({ ward_id: data.ward_id, item_id: { $in: itemIds } }).toArray(),
      db.collection<ItemDoc>("items").find({ id: { $in: itemIds } }).toArray(),
    ]);
    const catalogMap = new Map<number, CatalogDoc>(catalogEntries.map((c) => [c.item_id, c]));
    const itemNameMap = new Map<number, string>(itemDocs.map((i) => [i.id, i.name]));
    const nameOf = (itemId: number) => itemNameMap.get(itemId) || String(itemId);

    // Catalog membership and per-order max don't depend on other orders,
    // so validate them up front for fast, friendly failures.
    for (const item of items) {
      const catalogEntry = catalogMap.get(item.item_id);
      if (!catalogEntry) {
        return NextResponse.json(
          { error: `Item "${nameOf(item.item_id)}" tidak tersedia dalam katalog wad ini.` },
          { status: 400 }
        );
      }
      const violation = checkMaxPerOrder(catalogEntry, item.quantity);
      if (violation) {
        return NextResponse.json(
          { error: formatViolation(violation, nameOf(item.item_id)) },
          { status: 400 }
        );
      }
    }

    const quotaItemIds = catalogEntries
      .filter((c) => c.monthly_quota != null && c.monthly_quota > 0)
      .map((c) => c.item_id);

    const orderMonth = data.order_date.slice(0, 7);
    const { start: startOfMonth, end: endOfMonth } = getMonthRange(orderMonth);

    const notifications: string[] = [];
    let nextId = 0;
    const now = new Date().toISOString();

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        // withTransaction may retry on transient errors; don't duplicate warnings.
        notifications.length = 0;

        // Serialize concurrent creations for the same ward + month so the
        // quota check below cannot race with another in-flight order.
        await db.collection<CounterDoc>("counters").findOneAndUpdate(
          { _id: `order_lock_${data.ward_id}_${startOfMonth.slice(0, 7)}` },
          { $inc: { seq: 1 } },
          { upsert: true, session }
        );

        // Re-check uniqueness inside the lock; the unique index on
        // order_number remains the final guard (E11000 handled below).
        const duplicate = await db.collection("orders").findOne(
          { order_number: data.order_number },
          { session }
        );
        if (duplicate) {
          throw statusError(400, "Nombor pesanan sudah wujud.");
        }

        // Read the month's usage inside the transaction so the quota check
        // sees every order committed before this one.
        const monthlyUsageMap = new Map<number, number>();
        if (quotaItemIds.length > 0) {
          const monthlyOrderItems = await db
            .collection("order_items")
            .aggregate(
              [
                {
                  $lookup: {
                    from: "orders",
                    localField: "order_id",
                    foreignField: "id",
                    as: "order",
                  },
                },
                { $unwind: "$order" },
                {
                  $match: {
                    "order.ward_id": data.ward_id,
                    "order.order_date": { $gte: startOfMonth, $lte: endOfMonth },
                    item_id: { $in: quotaItemIds },
                  },
                },
                { $group: { _id: "$item_id", total: { $sum: "$quantity" } } },
              ],
              { session }
            )
            .toArray();
          for (const row of monthlyOrderItems) {
            monthlyUsageMap.set(row._id, row.total);
          }
        }

        for (const item of items) {
          const catalogEntry = catalogMap.get(item.item_id);
          if (!catalogEntry) continue;

          const monthUsed = monthlyUsageMap.get(item.item_id) || 0;
          const violation = checkMonthlyQuota(catalogEntry, item.quantity, monthUsed);
          if (violation) {
            throw statusError(400, formatViolation(violation, nameOf(item.item_id)));
          }

          // Soft-limit notifications (presentation, not the rule itself).
          const quota = catalogEntry.monthly_quota;
          if (quota != null && quota > 0) {
            const newTotal = monthUsed + item.quantity;
            const remaining = quota - newTotal;
            if (remaining <= quota * 0.2 && remaining > 0) {
              notifications.push(
                `Amaran: Kuota "${nameOf(item.item_id)}" tinggal ${remaining} lagi (${newTotal}/${quota}).`
              );
            }
            if (newTotal === quota) {
              notifications.push(
                `Peringatan: Kuota "${nameOf(item.item_id)}" telah digunakan sepenuhnya (${newTotal}/${quota}).`
              );
            }
          }
        }

        const counter = await db.collection<CounterDoc>("counters").findOneAndUpdate(
          { _id: "orders" },
          { $inc: { seq: 1 } },
          { upsert: true, returnDocument: "after", session }
        );
        nextId = counter?.seq ?? 1;

        await db.collection("orders").insertOne(
          {
            id: nextId,
            ward_id: data.ward_id,
            order_date: data.order_date,
            order_number: data.order_number,
            order_type: data.order_type,
            masa_pejabat: data.masa_pejabat,
            masa_diterima: data.masa_diterima || null,
            sudah_disedia: data.sudah_disedia,
            completion_minutes: null,
            masa_selesai: null,
            created_at: now,
            updated_at: now,
          },
          { session }
        );

        await db.collection("order_items").insertMany(
          items.map((i) => ({
            order_id: nextId,
            item_id: i.item_id,
            quantity: i.quantity,
          })),
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json(
      { ok: true, id: nextId, notifications },
      { status: 201 }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "Nombor pesanan sudah wujud." },
        { status: 400 }
      );
    }
    const status = (error as { status?: number })?.status;
    if (status === 400) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 }
      );
    }
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Ralat mencipta pesanan." },
      { status: 500 }
    );
  }
}
