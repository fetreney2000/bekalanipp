import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";
import { ObjectId } from "mongodb";

const orderItemSchema = z.object({
  item_id: z.string().min(1),
  quantity: z.number().int().min(1),
});

const orderUpdateSchema = z.object({
  order_date: z.string().min(1),
  order_number: z.string().min(1),
  order_type: z.string().min(1),
  masa_pejabat: z.boolean().optional().default(false),
  masa_diterima: z.boolean().optional().default(false),
  sudah_disedia: z.boolean().optional().default(false),
  items: z.array(orderItemSchema).min(1, "Sekurang-kurangnya satu item diperlukan"),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const order = await db.collection("orders").findOne({ _id: new ObjectId(id) });

    if (!order) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemui" },
        { status: 404 }
      );
    }

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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan pesanan" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = orderUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const { db } = await connectToDatabase();

    const existingOrder = await db
      .collection("orders")
      .findOne({ _id: new ObjectId(id) });
    if (!existingOrder) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemui" },
        { status: 404 }
      );
    }

    const duplicateCheck = await db.collection("orders").findOne({
      order_number: data.order_number,
      _id: { $ne: new ObjectId(id) },
    });
    if (duplicateCheck) {
      return NextResponse.json(
        { error: "Nombor pesanan sudah wujud." },
        { status: 400 }
      );
    }

    for (const orderItem of data.items) {
      if (!ObjectId.isValid(orderItem.item_id)) {
        return NextResponse.json(
          { error: "ID item tidak sah" },
          { status: 400 }
        );
      }

      const catalogEntry = await db.collection("catalog").findOne({
        ward_id: existingOrder.ward_id,
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
              ward_id: existingOrder.ward_id,
              order_date: { $gte: startOfMonth, $lte: endOfMonth },
              "items.item_id": orderItem.item_id,
              _id: { $ne: new ObjectId(id) },
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
    }

    const now = new Date().toISOString();
    await db.collection("orders").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          order_date: data.order_date,
          order_number: data.order_number,
          order_type: data.order_type,
          masa_pejabat: data.masa_pejabat,
          masa_diterima: data.masa_diterima,
          sudah_disedia: data.sudah_disedia,
          items: data.items.map((i) => ({
            item_id: i.item_id,
            quantity: i.quantity,
          })),
          updated_at: now,
        },
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: "Ralat mengemaskini pesanan" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const result = await db
      .collection("orders")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemui" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: "Ralat memadam pesanan" },
      { status: 500 }
    );
  }
}
