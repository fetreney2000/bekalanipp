import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getDateRange } from "@/lib/date-range";
import type { ItemRow, OrderItemRow, OrderRow } from "@/lib/types";

/**
 * Exactly the fields selected below. Casting to the full OrderRow would lie
 * about the projection (it also declares ward_id, masa_diterima,
 * completion_minutes, created_at and masa_selesai, none of which are fetched).
 */
type WardOrderRow = Pick<
  OrderRow,
  "id" | "order_number" | "order_date" | "order_type" | "masa_pejabat" | "sudah_disedia"
>;

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
      return NextResponse.json({ error: "ward_id diperlukan." }, { status: 400 });
    }

    const { start, end } = getDateRange({ type, date, week, month, year });

    const { db } = await connectToDatabase();

    const orders = (await db
      .collection("orders")
      .find({ ward_id: Number(wardId), order_date: { $gte: start, $lte: end } })
      .project({ _id: 0, id: 1, order_number: 1, order_date: 1, order_type: 1, masa_pejabat: 1, sudah_disedia: 1 })
      .toArray()) as WardOrderRow[];

    const orderIds = orders.map((o) => o.id);

    const allOrderItems = orderIds.length > 0
      ? ((await db.collection("order_items").find({ order_id: { $in: orderIds } }).project({ _id: 0, order_id: 1, item_id: 1, quantity: 1 }).toArray()) as OrderItemRow[])
      : [];

    const referencedItemIds = [...new Set(allOrderItems.map((oi) => oi.item_id).filter(Boolean))];
    const items = referencedItemIds.length > 0
      ? ((await db.collection("items").find({ id: { $in: referencedItemIds } }).project({ _id: 0, id: 1, name: 1 }).toArray()) as ItemRow[])
      : [];
    const itemMap = new Map(items.map((i) => [i.id, i.name]));

    const result = orders
      .map((order) => {
        const items = allOrderItems
          .filter((oi) => oi.order_id === order.id)
          .map((oi) => ({
            item_name: itemMap.get(oi.item_id) || "Unknown",
            quantity: oi.quantity,
          }));
        const totalQty = items.reduce((s, i) => s + i.quantity, 0);
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
      .sort((a, b) => b.order_date.localeCompare(a.order_date));

    return NextResponse.json(
      { orders: result },
      { headers: { "Cache-Control": "no-cache" } }
    );
  } catch (error) {
    console.error("GET /api/reports/ward-orders error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan pesanan wad." },
      { status: 500 }
    );
  }
}
