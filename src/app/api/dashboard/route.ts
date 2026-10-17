import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import {
  currentYearMonth,
  getMonthRange,
  isValidYearMonth,
} from "@/lib/date-range";

type WardCountRow = { _id: number; count: number };
type UsageRow = { _id: { ward: number; item: number }; total: number };

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    // Reject malformed month params up front instead of silently turning
    // them into NaN dates and empty results.
    if (month && !isValidYearMonth(month)) {
      return NextResponse.json(
        { error: "month mesti berformat YYYY-MM." },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const monthStr = month || currentYearMonth();
    const { start: startOfMonth, end: endOfMonth } = getMonthRange(monthStr);
    const ordersMatch = { order_date: { $gte: startOfMonth, $lte: endOfMonth } };

    // Counts and per-ward tallies are computed inside MongoDB via $group, so
    // memory is bounded by the number of wards and distinct ward/item pairs
    // rather than by how many orders the month contains.
    const [wards, catalogEntries, wardCountRows, usageRows, itemsCount] =
      await Promise.all([
        db
          .collection("wards")
          .find({})
          .project({ _id: 0, id: 1, name: 1 })
          .sort({ name: 1 })
          .toArray(),
        db
          .collection("ward_catalog")
          .find({})
          .project({
            _id: 0,
            ward_id: 1,
            item_id: 1,
            monthly_quota: 1,
            max_per_order: 1,
          })
          .toArray(),
        db
          .collection("orders")
          .aggregate<WardCountRow>([
            { $match: ordersMatch },
            { $group: { _id: "$ward_id", count: { $sum: 1 } } },
          ])
          .toArray(),
        db
          .collection("orders")
          .aggregate<UsageRow>([
            { $match: ordersMatch },
            {
              $lookup: {
                from: "order_items",
                localField: "id",
                foreignField: "order_id",
                as: "lines",
              },
            },
            { $unwind: "$lines" },
            {
              $group: {
                _id: { ward: "$ward_id", item: "$lines.item_id" },
                total: { $sum: "$lines.quantity" },
              },
            },
          ])
          .toArray(),
        db.collection("items").countDocuments(),
      ]);

    const ordersCount = wardCountRows.reduce((sum, row) => sum + row.count, 0);

    const itemIdsWithQuota = [
      ...new Set(
        catalogEntries
          .filter((c) => (c.monthly_quota ?? 0) > 0)
          .map((c) => c.item_id as number)
      ),
    ];
    const allItems =
      itemIdsWithQuota.length > 0
        ? await db
            .collection("items")
            .find({ id: { $in: itemIdsWithQuota } })
            .project({ _id: 0, id: 1, name: 1 })
            .sort({ name: 1 })
            .toArray()
        : [];

    const wardMap = new Map<number, string>();
    for (const w of wards) {
      wardMap.set(w.id, w.name);
    }

    const itemMap = new Map<number, string>();
    for (const i of allItems) {
      itemMap.set(i.id, i.name);
    }

    const wardsWithQuota = catalogEntries.filter(
      (c) => c.monthly_quota != null && c.monthly_quota > 0
    );

    const usageMap = new Map<string, number>();
    for (const row of usageRows) {
      usageMap.set(`${row._id.ward}:${row._id.item}`, row.total || 0);
    }

    const itemStatus: {
      ward_name: string;
      item_name: string;
      quota: number;
      used: number;
    }[] = [];
    for (const cat of wardsWithQuota) {
      const wardName = wardMap.get(cat.ward_id) || "Unknown";
      const itemName = itemMap.get(cat.item_id) || "Unknown";
      const key = `${cat.ward_id}:${cat.item_id}`;
      const used = usageMap.get(key) || 0;
      itemStatus.push({
        ward_name: wardName,
        item_name: itemName,
        quota: cat.monthly_quota,
        used,
      });
    }
    itemStatus.sort(
      (a, b) =>
        a.ward_name.localeCompare(b.ward_name) ||
        a.item_name.localeCompare(b.item_name)
    );

    const warnings: typeof itemStatus = [];
    const exceeded: typeof itemStatus = [];
    for (const item of itemStatus) {
      if (item.quota > 0 && item.used >= item.quota) exceeded.push(item);
      else if (item.quota > 0 && item.used >= item.quota * 0.8)
        warnings.push(item);
    }

    const wardCounts = new Map<number, number>();
    for (const row of wardCountRows) {
      wardCounts.set(Number(row._id), row.count);
    }
    let topWard: {
      ward_id: number;
      ward_name: string;
      order_count: number;
    } | null = null;
    for (const ward of wards) {
      const count = wardCounts.get(ward.id) || 0;
      if (!topWard || count > topWard.order_count) {
        topWard = {
          ward_id: ward.id,
          ward_name: ward.name,
          order_count: count,
        };
      }
    }

    return NextResponse.json(
      {
        month: monthStr,
        itemStatus,
        warnings,
        exceeded,
        orders_count: ordersCount,
        items_count: itemsCount,
        top_ward: topWard,
      },
      { headers: { "Cache-Control": "no-cache" } }
    );
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan data papan pemuka." },
      { status: 500 }
    );
  }
}
