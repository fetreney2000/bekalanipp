import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";
import { ObjectId } from "mongodb";

const orderItemSchema = z.object({
  item_id: z.string().min(1),
  quantity: z.number().int().min(1),
});

const orderCreateSchema = z.object({
  ward_id: z.string().min(1),
  order_date: z.string().min(1),
  order_number: z.string().min(1),
  order_type: z.string().min(1),
  masa_pejabat: z.boolean().optional().default(false),
  masa_diterima: z.boolean().optional().default(false),
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

    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        let wardName = "Unknown";
        if (order.ward_id && ObjectId.isValid(order.ward_id)) {
          const ward = await db.collection("wards").findOne({ _id: new ObjectId(order.ward_id) });
          wardName = ward?.name || "Unknown";
        }
        const enrichedItems = await Promise.all(
          (order.items || []).map(async (item: { item_id: string; quantity: number }) => {
            let itemName = "Unknown";
            if (item.item_id && ObjectId.isValid(item.item_id)) {
              const itemDoc = await db
                .collection("items")
                .findOne({ _id: new ObjectId(item.item_id) });
              itemName = itemDoc?.name || "Unknown";
            }
            return {
              item_id: item.item_id,
              item_name: itemName,
              quantity: item.quantity,
            };
          })
        );
        return {
          id: order._id.toString(),
          ward_id: order.ward_id,
          ward_name: wardName,
          order_date: order.order_date,
          order_number: order.order_number,
          order_type: order.order_type,
          masa_pejabat: order.masa_pejabat || false,
          masa_diterima: order.masa_diterima || false,
          sudah_disedia: order.sudah_disedia || false,
          completion_minutes: order.completion_minutes || null,
          masa_selesai: order.masa_selesai || null,
          items: enrichedItems,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };
      })
    );

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

    if (!ObjectId.isValid(data.ward_id)) {
      return NextResponse.json({ error: "ID wad tidak sah" }, { status: 400 });
    }

    const ward = await db.collection("wards").findOne({ _id: new ObjectId(data.ward_id) });
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
      if (!ObjectId.isValid(orderItem.item_id)) {
        return NextResponse.json(
          { error: "ID item tidak sah" },
          { status: 400 }
        );
      }

      const catalogEntry = await db.collection("catalog").findOne({
        ward_id: data.ward_id,
        item_id: orderItem.item_id,
      });

      if (!catalogEntry) {
        let itemName = orderItem.item_id;
        if (ObjectId.isValid(orderItem.item_id)) {
          const itemDoc = await db
            .collection("items")
            .findOne({ _id: new ObjectId(orderItem.item_id) });
          itemName = itemDoc?.name || orderItem.item_id;
        }
        return NextResponse.json(
          { error: `Item "${itemName}" tidak tersedia dalam katalog wad ini.` },
          { status: 400 }
        );
      }

      if (orderItem.quantity > catalogEntry.max_per_order) {
        let itemName = orderItem.item_id;
        if (ObjectId.isValid(orderItem.item_id)) {
          const itemDoc = await db
            .collection("items")
            .findOne({ _id: new ObjectId(orderItem.item_id) });
          itemName = itemDoc?.name || orderItem.item_id;
        }
        return NextResponse.json(
          {
            error: `Kuantiti untuk "${itemName}" melebihi had setiap pesanan (maksimum: ${catalogEntry.max_per_order}).`,
          },
          { status: 400 }
        );
      }

      const [yearStr, monthStr] = data.order_date.split("-");
      const year = parseInt(yearStr);
      const m = parseInt(monthStr);
      const startOfMonth = `${yearStr}-${monthStr}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      const endOfMonth = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

      const usageAgg = await db
        .collection("orders")
        .aggregate([
          {
            $match: {
              ward_id: data.ward_id,
              order_date: { $gte: startOfMonth, $lte: endOfMonth },
              "items.item_id": orderItem.item_id,
            },
          },
          { $unwind: "$items" },
          { $match: { "items.item_id": orderItem.item_id } },
          { $group: { _id: null, total: { $sum: "$items.quantity" } } },
        ])
        .toArray();

      const monthUsed = usageAgg[0]?.total || 0;
      const newTotal = monthUsed + orderItem.quantity;

      if (newTotal > catalogEntry.monthly_quota) {
        let itemName = orderItem.item_id;
        if (ObjectId.isValid(orderItem.item_id)) {
          const itemDoc = await db
            .collection("items")
            .findOne({ _id: new ObjectId(orderItem.item_id) });
          itemName = itemDoc?.name || orderItem.item_id;
        }
        return NextResponse.json(
          {
            error: `Kuota bulanan untuk "${itemName}" akan dilampaui. Kuota: ${catalogEntry.monthly_quota}, sudah digunakan: ${monthUsed}, pesanan ini: ${orderItem.quantity}.`,
          },
          { status: 400 }
        );
      }

      let itemName = orderItem.item_id;
      if (ObjectId.isValid(orderItem.item_id)) {
        const itemDoc = await db
          .collection("items")
          .findOne({ _id: new ObjectId(orderItem.item_id) });
        itemName = itemDoc?.name || orderItem.item_id;
      }

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

    const now = new Date().toISOString();
    const result = await db.collection("orders").insertOne({
      ward_id: data.ward_id,
      order_date: data.order_date,
      order_number: data.order_number,
      order_type: data.order_type,
      masa_pejabat: data.masa_pejabat,
      masa_diterima: data.masa_diterima,
      sudah_disedia: data.sudah_disedia,
      completion_minutes: null,
      masa_selesai: null,
      items: data.items.map((i) => ({
        item_id: i.item_id,
        quantity: i.quantity,
      })),
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json(
      { ok: true, id: result.insertedId.toString(), notifications },
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
