import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

const orderItemSchema = z.object({
  item_id: z.number().int(),
  quantity: z.number().int().min(1),
});

const orderCreateSchema = z.object({
  ward_id: z.number().int(),
  order_date: z.string().min(1),
  order_number: z.string().min(1),
  order_type: z.string().min(1),
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

    const { db } = await connectToDatabase();

    const filter: Record<string, unknown> = {};
    if (from || to) {
      const dateFilter: Record<string, string> = {};
      if (from) dateFilter.$gte = from;
      if (to) dateFilter.$lte = to;
      filter.order_date = dateFilter;
    }

    const orders = await db
      .collection("orders")
      .find(filter)
      .sort({ order_date: -1, created_at: -1 })
      .limit(500)
      .toArray();

    const orderIds = orders.map((o: any) => o.id);
    const wardIds = [...new Set(orders.map((o: any) => Number(o.ward_id)).filter(Boolean))];

    const [allOrderItems, allWards, allItems] = await Promise.all([
      orderIds.length > 0
        ? db.collection("order_items").find({ order_id: { $in: orderIds } }).toArray()
        : Promise.resolve([]),
      wardIds.length > 0
        ? db.collection("wards").find({ id: { $in: wardIds } }).toArray()
        : Promise.resolve([]),
      db.collection("items").find({}).toArray(),
    ]);

    const wardMap = new Map(allWards.map((w: any) => [w.id, w.name]));
    const itemMap = new Map(allItems.map((i: any) => [i.id, i.name]));

    const orderItemsByOrder = new Map<number, any[]>();
    for (const oi of allOrderItems) {
      const oid = oi.order_id;
      if (!orderItemsByOrder.has(oid)) orderItemsByOrder.set(oid, []);
      orderItemsByOrder.get(oid)!.push(oi);
    }

    const enrichedOrders = orders.map((order) => {
      const wardName = wardMap.get(Number(order.ward_id)) || "Unknown";
      const orderItemsDocs = orderItemsByOrder.get(order.id) || [];
      const enrichedItems = orderItemsDocs.map((item: any) => ({
        item_id: item.item_id,
        item_name: itemMap.get(item.item_id) || "Unknown",
        quantity: item.quantity,
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
        updated_at: order.updated_at,
      };
    });

    return NextResponse.json(enrichedOrders);
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan senarai pesanan" },
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
        { error: parsed.error.issues[0]?.message || "Data tidak sah" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const { db } = await connectToDatabase();

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

    const notifications: string[] = [];

    for (const orderItem of data.items) {
      const catalogEntry = await db.collection("ward_catalog").findOne({
        ward_id: data.ward_id,
        item_id: orderItem.item_id,
      });

      if (!catalogEntry) {
        const itemDoc = await db
          .collection("items")
          .findOne({ id: Number(orderItem.item_id) });
        const itemName = itemDoc?.name || String(orderItem.item_id);
        return NextResponse.json(
          { error: `Item "${itemName}" tidak tersedia dalam katalog wad ini.` },
          { status: 400 }
        );
      }

      if (catalogEntry.max_per_order > 0 && orderItem.quantity > catalogEntry.max_per_order) {
        const itemDoc = await db
          .collection("items")
          .findOne({ id: Number(orderItem.item_id) });
        const itemName = itemDoc?.name || String(orderItem.item_id);
        return NextResponse.json(
          {
            error: `Kuantiti untuk "${itemName}" melebihi had setiap pesanan (maksimum: ${catalogEntry.max_per_order}).`,
          },
          { status: 400 }
        );
      }

      if (catalogEntry.monthly_quota != null) {
        const [yearStr, monthStr] = data.order_date.split("-");
        const year = parseInt(yearStr);
        const m = parseInt(monthStr);
        const startOfMonth = `${yearStr}-${monthStr}-01`;
        const lastDay = new Date(year, m, 0).getDate();
        const endOfMonth = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

        const monthOrderItems = await db
          .collection("order_items")
          .aggregate([
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
                item_id: orderItem.item_id,
              },
            },
            { $group: { _id: null, total: { $sum: "$quantity" } } },
          ])
          .toArray();

        const monthUsed = monthOrderItems[0]?.total || 0;
        const newTotal = monthUsed + orderItem.quantity;

        if (newTotal > catalogEntry.monthly_quota) {
          const itemDoc = await db
            .collection("items")
            .findOne({ id: Number(orderItem.item_id) });
          const itemName = itemDoc?.name || String(orderItem.item_id);
          return NextResponse.json(
            {
              error: `Kuota bulanan untuk "${itemName}" akan dilampaui. Kuota: ${catalogEntry.monthly_quota}, sudah digunakan: ${monthUsed}, pesanan ini: ${orderItem.quantity}.`,
            },
            { status: 400 }
          );
        }

        const itemDoc = await db
          .collection("items")
          .findOne({ id: Number(orderItem.item_id) });
        const itemName = itemDoc?.name || String(orderItem.item_id);

        const remaining = catalogEntry.monthly_quota - newTotal;
        if (remaining <= catalogEntry.monthly_quota * 0.2 && remaining > 0) {
          notifications.push(
            `Amaran: Kuota "${itemName}" tinggal ${remaining} lagi (${newTotal}/${catalogEntry.monthly_quota}).`
          );
        }
        if (newTotal === catalogEntry.monthly_quota) {
          notifications.push(
            `Peringatan: Kuota "${itemName}" telah digunakan sepenuhnya (${newTotal}/${catalogEntry.monthly_quota}).`
          );
        }
      }
    }

    const counter = await db.collection("counters").findOneAndUpdate(
      { _id: "orders" } as any,
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const nextId = counter?.seq ?? 1;

    const now = new Date().toISOString();
    await db.collection("orders").insertOne({
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
    });

    if (data.items.length > 0) {
      await db.collection("order_items").insertMany(
        data.items.map((i) => ({
          order_id: nextId,
          item_id: i.item_id,
          quantity: i.quantity,
        }))
      );
    }

    return NextResponse.json(
      { ok: true, id: nextId, notifications },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Ralat mencipta pesanan" },
      { status: 500 }
    );
  }
}
