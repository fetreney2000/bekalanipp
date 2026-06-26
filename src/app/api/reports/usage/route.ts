import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

interface ReportSummary {
  item_id: string;
  item_name: string;
  quantity: number;
}

interface WardSummary {
  ward_id: string;
  ward_name: string;
  quantity: number;
}

interface MasaSummary {
  masa_pejabat: boolean;
  quantity: number;
}

interface MasaCatSummary {
  ward_category: string;
  masa_pejabat: boolean;
  quantity: number;
}

interface Recommendation {
  item_id: string;
  item_name: string;
  avg_per_day: number;
  recommended_stock: number;
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

    const { start, end } = getDateRange(type, date, week, month, year);

    const { db } = await connectToDatabase();

    const orders = await db
      .collection("orders")
      .find({ order_date: { $gte: start, $lte: end } })
      .toArray();

    const items = await db.collection("items").find({}).toArray();
    const wards = await db.collection("wards").find({}).toArray();

    const itemMap = new Map(items.map((i) => [i._id.toString(), i.name]));
    const wardMap = new Map(
      wards.map((w) => [w._id.toString(), { name: w.name, category: w.category }])
    );

    const summaryMap = new Map<string, number>();
    const wardSummaryMap = new Map<string, number>();
    const masaMap = new Map<string, number>();
    const masaCatMap = new Map<string, number>();

    let totalQuantity = 0;
    const totalOrders = orders.length;

    for (const order of orders) {
      const wardInfo = wardMap.get(order.ward_id);
      const isMasaPejabat = order.masa_pejabat || false;
      const masaKey = isMasaPejabat ? "pejabat" : "bukan_pejabat";

      for (const item of order.items || []) {
        const itemId = item.item_id;
        const qty = item.quantity;
        totalQuantity += qty;

        summaryMap.set(itemId, (summaryMap.get(itemId) || 0) + qty);
        wardSummaryMap.set(
          order.ward_id,
          (wardSummaryMap.get(order.ward_id) || 0) + qty
        );

        masaMap.set(masaKey, (masaMap.get(masaKey) || 0) + qty);

        const cat = wardInfo?.category || "unknown";
        const masaCatKey = `${cat}_${masaKey}`;
        masaCatMap.set(masaCatKey, (masaCatMap.get(masaCatKey) || 0) + qty);
      }
    }

    const summary: ReportSummary[] = Array.from(summaryMap.entries())
      .map(([itemId, quantity]) => ({
        item_id: itemId,
        item_name: itemMap.get(itemId) || "Unknown",
        quantity,
      }))
      .sort((a, b) => b.quantity - a.quantity);

    const totals_by_ward: WardSummary[] = Array.from(wardSummaryMap.entries())
      .map(([wardId, quantity]) => ({
        ward_id: wardId,
        ward_name: wardMap.get(wardId)?.name || "Unknown",
        quantity,
      }))
      .sort((a, b) => b.quantity - a.quantity);

    const totals_by_masa: MasaSummary[] = Array.from(masaMap.entries()).map(
      ([key, quantity]) => ({
        masa_pejabat: key === "pejabat",
        quantity,
      })
    );

    const totals_by_masa_by_cat: MasaCatSummary[] = Array.from(
      masaCatMap.entries()
    ).map(([key, quantity]) => {
      const parts = key.split("_");
      const masaKey = parts[parts.length - 1];
      const cat = parts.slice(0, -1).join("_");
      return {
        ward_category: cat,
        masa_pejabat: masaKey === "pejabat",
        quantity,
      };
    });

    const dayCount = Math.max(
      1,
      Math.round(
        (new Date(end).getTime() - new Date(start).getTime()) / 86400000
      ) + 1
    );

    const recommendations: Recommendation[] = summary.map((s) => {
      const avgPerDay = s.quantity / dayCount;
      return {
        item_id: s.item_id,
        item_name: s.item_name,
        avg_per_day: Math.round(avgPerDay * 100) / 100,
        recommended_stock: Math.ceil(avgPerDay * 30),
      };
    });

    return NextResponse.json({
      type,
      start,
      end,
      summary,
      totals_by_ward,
      totals: { orders: totalOrders, quantity: totalQuantity },
      totals_by_masa,
      totals_by_masa_by_cat,
      recommendations,
    });
  } catch (error) {
    console.error("GET /api/reports/usage error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan laporan penggunaan" },
      { status: 500 }
    );
  }
}
