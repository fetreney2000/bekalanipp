import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getDateRange } from "@/lib/date-range";
import type { OrderItemRow } from "@/lib/types";

interface WardItemResult {
  item_id: number;
  item_name: string;
  order_count: number;
  quantity_sum: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "monthly";
    const date = searchParams.get("date");
    const week = searchParams.get("week");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const wardId = searchParams.get("ward_id");

    const { start, end } = getDateRange({ type, date, week, month, year });

    const { db } = await connectToDatabase();

    const filter: Record<string, unknown> = {
      order_date: { $gte: start, $lte: end },
    };
    if (wardId) {
      filter.ward_id = Number(wardId);
    }

    const orders = (await db.collection("orders").find(filter).project({ _id: 0, id: 1 }).toArray()) as { id: number }[];
    const orderIds = orders.map((o) => o.id);

    const allOrderItems = orderIds.length > 0
      ? ((await db.collection("order_items").find({ order_id: { $in: orderIds } }).project({ _id: 0, item_id: 1, order_id: 1, quantity: 1 }).toArray()) as OrderItemRow[])
      : [];

    const itemStats = new Map<
      number,
      { order_count: number; quantity_sum: number }
    >();

    const orderItemCount = new Map<number, Set<number>>();

    for (const oi of allOrderItems) {
      const itemId = oi.item_id;
      const existing = itemStats.get(itemId) || {
        order_count: 0,
        quantity_sum: 0,
      };
      existing.quantity_sum += oi.quantity;

      if (!orderItemCount.has(itemId)) orderItemCount.set(itemId, new Set());
      orderItemCount.get(itemId)!.add(oi.order_id);

      itemStats.set(itemId, existing);
    }

    for (const [itemId, stats] of itemStats) {
      stats.order_count = orderItemCount.get(itemId)?.size || 0;
    }

    const neededItemIds = [...itemStats.keys()];
    const items = neededItemIds.length > 0
      ? await db.collection("items").find({ id: { $in: neededItemIds } }).project({ _id: 0, id: 1, name: 1 }).toArray()
      : [];
    const itemMap = new Map(items.map((i) => [i.id, i.name]));

    const result: WardItemResult[] = Array.from(itemStats.entries())
      .map(([itemId, stats]) => ({
        item_id: itemId,
        item_name: itemMap.get(itemId) || "Unknown",
        order_count: stats.order_count,
        quantity_sum: stats.quantity_sum,
      }))
      .sort((a, b) => b.quantity_sum - a.quantity_sum);

    return NextResponse.json(
      { items: result },
      { headers: { "Cache-Control": "no-cache" } }
    );
  } catch (error) {
    console.error("GET /api/reports/ward-items error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan laporan item wad." },
      { status: 500 }
    );
  }
}
