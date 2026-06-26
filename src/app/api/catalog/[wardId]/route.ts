import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";
import { ObjectId } from "mongodb";

const catalogUpsertSchema = z.object({
  item_id: z.string().min(1),
  max_per_order: z.number().int().min(0),
  monthly_quota: z.number().int().min(0),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wardId: string }> }
) {
  try {
    const { wardId } = await params;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!ObjectId.isValid(wardId)) {
      return NextResponse.json({ error: "ID wad tidak sah" }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const ward = await db.collection("wards").findOne({ _id: new ObjectId(wardId) });
    if (!ward) {
      return NextResponse.json({ error: "Wad/jabatan tidak ditemui" }, { status: 404 });
    }

    const catalogEntries = await db
      .collection("catalog")
      .find({ ward_id: wardId })
      .toArray();

    const items = await Promise.all(
      catalogEntries.map(async (entry) => {
        const item = ObjectId.isValid(entry.item_id)
          ? await db.collection("items").findOne({ _id: new ObjectId(entry.item_id) })
          : null;
        const result: Record<string, unknown> = {
          ward_id: entry.ward_id,
          item_id: entry.item_id,
          item_name: item?.name || "Unknown",
          max_per_order: entry.max_per_order,
          monthly_quota: entry.monthly_quota,
        };

        if (month) {
          const startOfMonth = `${month}-01`;
          const [yearStr, monthStr] = month.split("-");
          const year = parseInt(yearStr);
          const m = parseInt(monthStr);
          const lastDay = new Date(year, m, 0).getDate();
          const endOfMonth = `${month}-${String(lastDay).padStart(2, "0")}`;

          const usageAgg = await db
            .collection("orders")
            .aggregate([
              {
                $match: {
                  ward_id: wardId,
                  order_date: { $gte: startOfMonth, $lte: endOfMonth },
                  "items.item_id": entry.item_id,
                },
              },
              { $unwind: "$items" },
              { $match: { "items.item_id": entry.item_id } },
              { $group: { _id: null, total: { $sum: "$items.quantity" } } },
            ])
            .toArray();

          result.month_used = usageAgg[0]?.total || 0;
        }

        return result;
      })
    );

    return NextResponse.json({ ward: ward.name, items });
  } catch (error) {
    console.error("GET /api/catalog/[wardId] error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan katalog wad" },
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
    const body = await request.json();
    const parsed = catalogUpsertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(wardId)) {
      return NextResponse.json({ error: "ID wad tidak sah" }, { status: 400 });
    }
    if (!ObjectId.isValid(parsed.data.item_id)) {
      return NextResponse.json({ error: "ID item tidak sah" }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const ward = await db.collection("wards").findOne({ _id: new ObjectId(wardId) });
    if (!ward) {
      return NextResponse.json(
        { error: "Wad/jabatan tidak ditemui" },
        { status: 404 }
      );
    }

    const item = await db.collection("items").findOne({ _id: new ObjectId(parsed.data.item_id) });
    if (!item) {
      return NextResponse.json(
        { error: "Item tidak ditemui" },
        { status: 404 }
      );
    }

    await db.collection("catalog").updateOne(
      { ward_id: wardId, item_id: parsed.data.item_id },
      {
        $set: {
          ward_id: wardId,
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
      { error: "Ralat menyimpan katalog" },
      { status: 500 }
    );
  }
}
