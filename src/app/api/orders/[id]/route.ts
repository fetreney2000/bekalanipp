import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

const orderItemSchema = z.object({
  item_id: z.number().int(),
  quantity: z.number().int().min(1),
});

const orderUpdateSchema = z.object({
  order_date: z.string().min(1),
  order_number: z.string().min(1),
  order_type: z.string().min(1),
  masa_pejabat: z.boolean().optional().default(false),
  masa_diterima: z.string().optional().nullable(),
  sudah_disedia: z.boolean().optional().default(false),
  items: z.array(orderItemSchema).min(1, "Sekurang-kurangnya satu item diperlukan"),
});

async function getOrderItems(db: Awaited<ReturnType<typeof connectToDatabase>>["db"], orderId: number) {
  const orderItemsDocs = await db
    .collection("order_items")
    .find({ order_id: orderId })
    .toArray();
  return Promise.all(
    orderItemsDocs.map(async (item: any) => {
      let itemName = "Unknown";
      if (item.item_id != null) {
        const itemDoc = await db
          .collection("items")
          .findOne({ id: Number(item.item_id) });
        itemName = itemDoc?.name || "Unknown";
      }
      return {
        item_id: item.item_id,
        item_name: itemName,
        quantity: item.quantity,
      };
    })
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numberId = Number(id);

    if (isNaN(numberId)) {
      return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const order = await db.collection("orders").findOne({ id: numberId });

    if (!order) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemui" },
        { status: 404 }
      );
    }

    let wardName = "Unknown";
    if (order.ward_id != null) {
      const ward = await db.collection("wards").findOne({ id: Number(order.ward_id) });
      wardName = ward?.name || "Unknown";
    }

    const enrichedItems = await getOrderItems(db, numberId);

    return NextResponse.json({
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
    const numberId = Number(id);

    if (isNaN(numberId)) {
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
      .findOne({ id: numberId });
    if (!existingOrder) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemui" },
        { status: 404 }
      );
    }

    const duplicateCheck = await db.collection("orders").findOne({
      order_number: data.order_number,
      id: { $ne: numberId },
    });
    if (duplicateCheck) {
      return NextResponse.json(
        { error: "Nombor pesanan sudah wujud." },
        { status: 400 }
      );
    }

    for (const orderItem of data.items) {
      const catalogEntry = await db.collection("ward_catalog").findOne({
        ward_id: existingOrder.ward_id,
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
                "order.ward_id": existingOrder.ward_id,
                "order.order_date": { $gte: startOfMonth, $lte: endOfMonth },
                "order.id": { $ne: numberId },
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
      }
    }

    const now = new Date().toISOString();
    await db.collection("orders").updateOne(
      { id: numberId },
      {
        $set: {
          order_date: data.order_date,
          order_number: data.order_number,
          order_type: data.order_type,
          masa_pejabat: data.masa_pejabat,
          masa_diterima: data.masa_diterima || null,
          sudah_disedia: data.sudah_disedia,
          updated_at: now,
        },
      }
    );

    await db.collection("order_items").deleteMany({ order_id: numberId });
    if (data.items.length > 0) {
      await db.collection("order_items").insertMany(
        data.items.map((i) => ({
          order_id: numberId,
          item_id: i.item_id,
          quantity: i.quantity,
        }))
      );
    }

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
    const numberId = Number(id);

    if (isNaN(numberId)) {
      return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    await db.collection("order_items").deleteMany({ order_id: numberId });

    const result = await db
      .collection("orders")
      .deleteOne({ id: numberId });

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
