import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getDateRange } from "@/lib/date-range";
import type { WardRow } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "monthly";
    const date = searchParams.get("date");
    const week = searchParams.get("week");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const itemId = searchParams.get("item_id");

    if (!itemId) {
      return NextResponse.json({ error: "item_id diperlukan." }, { status: 400 });
    }

    const { start, end } = getDateRange({ type, date, week, month, year });

    const { db } = await connectToDatabase();

    // Match orders by date FIRST, then pull only this item's lines for those
    // orders. The previous order loaded every order_items row for the item
    // across all time and filtered by date in memory.
    // This projection omits order_type, so a narrower row type fits it exactly.
    interface ItemOrderRow {
      id: number;
      ward_id: number;
      order_number: string;
      order_date: string;
      masa_pejabat: boolean;
      sudah_disedia: boolean;
    }

    const orders = (await db
      .collection("orders")
      .find({ order_date: { $gte: start, $lte: end } })
      .project({ _id: 0, id: 1, order_number: 1, order_date: 1, ward_id: 1, masa_pejabat: 1, sudah_disedia: 1 })
      .toArray()) as ItemOrderRow[];

    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const orderIds = orders.map((o) => o.id);

    // This projection selects order_id + quantity only (item_id is the filter).
    type OrderItemLite = { order_id: number; quantity: number };

    const orderItems = orderIds.length > 0
      ? ((await db
          .collection("order_items")
          .find({ item_id: Number(itemId), order_id: { $in: orderIds } })
          .project({ _id: 0, order_id: 1, quantity: 1 })
          .toArray()) as OrderItemLite[])
      : [];

    const referencedWardIds = [...new Set(orders.map((o) => Number(o.ward_id)).filter(Boolean))];
    const wards = referencedWardIds.length > 0
      ? ((await db.collection("wards").find({ id: { $in: referencedWardIds } }).project({ _id: 0, id: 1, name: 1 }).toArray()) as WardRow[])
      : [];
    const wardMap = new Map(wards.map((w) => [w.id, w.name]));

    interface ItemOrderResult {
      order_id: number;
      order_number: string;
      order_date: string;
      ward_name: string;
      quantity: number;
      masa_pejabat: boolean;
      sudah_disedia: boolean;
    }

    const result = orderItems
      .filter((oi) => orderMap.has(oi.order_id))
      .map((oi): ItemOrderResult => {
        const order = orderMap.get(oi.order_id)!;
        return {
          order_id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          ward_name: wardMap.get(Number(order.ward_id)) || "Unknown",
          quantity: oi.quantity,
          masa_pejabat: order.masa_pejabat,
          sudah_disedia: order.sudah_disedia,
        };
      })
      .sort((a, b) => b.order_date.localeCompare(a.order_date));

    return NextResponse.json(
      { orders: result },
      { headers: { "Cache-Control": "no-cache" } }
    );
  } catch (error) {
    console.error("GET /api/reports/item-orders error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan pesanan item." },
      { status: 500 }
    );
  }
}
