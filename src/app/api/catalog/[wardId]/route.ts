import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

const catalogUpsertSchema = z.object({
  item_id: z.number().int(),
  max_per_order: z.number().int().min(0),
  monthly_quota: z.number().int().min(0),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wardId: string }> }
) {
  try {
    const { wardId } = await params;
    const numberWardId = Number(wardId);
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (isNaN(numberWardId)) {
      return NextResponse.json({ error: "ID wad tidak sah." }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const ward = await db.collection("wards").findOne({ id: numberWardId });
    if (!ward) {
      return NextResponse.json({ error: "Wad/jabatan tidak ditemui." }, { status: 404 });
    }

    const catalogEntries = await db
      .collection("ward_catalog")
      .find({ ward_id: numberWardId })
      .project({ _id: 0, ward_id: 1, item_id: 1, max_per_order: 1, monthly_quota: 1 })
      .toArray();

    const itemIds = catalogEntries.map((e: any) => e.item_id);
    const itemDocs = itemIds.length > 0
      ? await db.collection("items").find({ id: { $in: itemIds } }).project({ _id: 0, id: 1, name: 1 }).toArray()
      : [];
    const itemNameMap = new Map(itemDocs.map((i: any) => [i.id, i.name]));

    let usageMap = new Map<number, number>();
    if (month && catalogEntries.length > 0) {
      const startOfMonth = `${month}-01`;
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr);
      const m = parseInt(monthStr);
      const lastDay = new Date(year, m, 0).getDate();
      const endOfMonth = `${month}-${String(lastDay).padStart(2, "0")}`;

      const usageAgg = await db
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
              "order.ward_id": String(numberWardId),
              "order.order_date": { $gte: startOfMonth, $lte: endOfMonth },
              item_id: { $in: itemIds },
            },
          },
          { $group: { _id: "$item_id", total: { $sum: "$quantity" } } },
        ])
        .toArray();
      for (const row of usageAgg) {
        usageMap.set(row._id, row.total);
      }
    }

    const items = catalogEntries.map((entry) => ({
      ward_id: entry.ward_id,
      item_id: entry.item_id,
      item_name: itemNameMap.get(entry.item_id) || "Unknown",
      max_per_order: entry.max_per_order,
      monthly_quota: entry.monthly_quota,
      ...(month && { month_used: usageMap.get(entry.item_id) || 0 }),
    }));

    return NextResponse.json(
      { ward: ward.name, items },
      { headers: { "Cache-Control": "no-cache" } }
    );
  } catch (error) {
    console.error("GET /api/catalog/[wardId] error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan katalog wad." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ wardId: string }> }
) {
  try {
    const { wardId } = await params;
    const numberWardId = Number(wardId);
    const body = await request.json();
    const parsed = catalogUpsertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah." },
        { status: 400 }
      );
    }

    if (isNaN(numberWardId)) {
      return NextResponse.json({ error: "ID wad tidak sah." }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const ward = await db.collection("wards").findOne({ id: numberWardId });
    if (!ward) {
      return NextResponse.json(
        { error: "Wad/jabatan tidak ditemui." },
        { status: 404 }
      );
    }

    const item = await db.collection("items").findOne({ id: parsed.data.item_id });
    if (!item) {
      return NextResponse.json(
        { error: "Item tidak ditemui." },
        { status: 404 }
      );
    }

    await db.collection("ward_catalog").updateOne(
      { ward_id: numberWardId, item_id: parsed.data.item_id },
      {
        $set: {
          ward_id: numberWardId,
          item_id: parsed.data.item_id,
          max_per_order: parsed.data.max_per_order,
          monthly_quota: parsed.data.monthly_quota,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/catalog/[wardId] error:", error);
    return NextResponse.json(
      { error: "Ralat menyimpan katalog." },
      { status: 500 }
    );
  }
}
