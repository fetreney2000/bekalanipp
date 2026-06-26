import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

interface WardItemResult {
  item_id: number;
  item_name: string;
  order_count: number;
  quantity_sum: number;
}

function getDateRange(
  type: string,
  date?: string | null,
  week?: string | null,
  month?: string | null,
  year?: string | null
): { start: string; end: string } {
  const now = new Date();

  switch (type) {
    case "daily": {
      const d = date || now.toISOString().slice(0, 10);
      return { start: d, end: d };
    }
    case "weekly": {
      if (week) {
        const [y, w] = week.split("-W").map(Number);
        const jan1 = new Date(y, 0, 1);
        const dayOffset = jan1.getDay() || 7;
        const weekStart = new Date(y, 0, 1 + (w - 1) * 7 - (dayOffset - 1));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return {
          start: weekStart.toISOString().slice(0, 10),
          end: weekEnd.toISOString().slice(0, 10),
        };
      }
      const today = now;
      const dayOfWeek = today.getDay() || 7;
      const start = new Date(today);
      start.setDate(today.getDate() - dayOfWeek + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    case "monthly": {
      if (month) {
        const [y, m] = month.split("-").map(Number);
        const start = `${y}-${String(m).padStart(2, "0")}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        return { start, end };
      }
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return { start, end };
    }
    case "yearly": {
      const yr = year ? parseInt(year) : now.getFullYear();
      return { start: `${yr}-01-01`, end: `${yr}-12-31` };
    }
    default: {
      const d = date || now.toISOString().slice(0, 10);
      return { start: d, end: d };
    }
  }
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

    const { start, end } = getDateRange(type, date, week, month, year);

    const { db } = await connectToDatabase();

    const filter: Record<string, unknown> = {
      order_date: { $gte: start, $lte: end },
    };
    if (wardId) {
      filter.ward_id = Number(wardId);
    }

    const orders = await db.collection("orders").find(filter).toArray();
    const orderIds = orders.map((o: any) => o.id);

    const allOrderItems = orderIds.length > 0
      ? await db.collection("order_items").find({ order_id: { $in: orderIds } }).toArray()
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

    const items = await db.collection("items").find({}).toArray();
    const itemMap = new Map(items.map((i) => [i.id, i.name]));

    const result: WardItemResult[] = Array.from(itemStats.entries())
      .map(([itemId, stats]) => ({
        item_id: itemId,
        item_name: itemMap.get(itemId) || "Unknown",
        order_count: stats.order_count,
        quantity_sum: stats.quantity_sum,
      }))
      .sort((a, b) => b.quantity_sum - a.quantity_sum);

    return NextResponse.json({ items: result });
  } catch (error) {
    console.error("GET /api/reports/ward-items error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan laporan item wad" },
      { status: 500 }
    );
  }
}
