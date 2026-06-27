import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

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

    if (!wardId) {
      return NextResponse.json({ error: "ward_id diperlukan" }, { status: 400 });
    }

    const { start, end } = getDateRange(type, date, week, month, year);

    const { db } = await connectToDatabase();

    const orders = await db
      .collection("orders")
      .find({ ward_id: Number(wardId), order_date: { $gte: start, $lte: end } })
      .toArray();

    const orderIds = orders.map((o: any) => o.id);

    const allOrderItems = orderIds.length > 0
      ? await db.collection("order_items").find({ order_id: { $in: orderIds } }).toArray()
      : [];

    const itemMap = new Map(
      (await db.collection("items").find({}).toArray()).map((i: any) => [i.id, i.name])
    );

    const result = orders
      .map((order: any) => {
        const items = allOrderItems
          .filter((oi: any) => oi.order_id === order.id)
          .map((oi: any) => ({
            item_name: itemMap.get(oi.item_id) || "Unknown",
            quantity: oi.quantity,
          }));
        const totalQty = items.reduce((s: number, i: any) => s + i.quantity, 0);
        return {
          order_id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          order_type: order.order_type,
          masa_pejabat: order.masa_pejabat,
          sudah_disedia: order.sudah_disedia,
          items,
          total_quantity: totalQty,
        };
      })
      .sort((a: any, b: any) => b.order_date.localeCompare(a.order_date));

    return NextResponse.json({ orders: result });
  } catch (error) {
    console.error("GET /api/reports/ward-orders error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan pesanan wad" },
      { status: 500 }
    );
  }
}
