import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getDateRange } from "@/lib/date-range";
import type { OrderItemRow, OrderRow, WardRow } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "monthly";
    const date = searchParams.get("date");
    const week = searchParams.get("week");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const { start, end } = getDateRange({ type, date, week, month, year });

    const { db } = await connectToDatabase();

    const orders = (await db
      .collection("orders")
      .find({ order_date: { $gte: start, $lte: end } })
      .project({ _id: 0, id: 1, ward_id: 1, order_date: 1, order_number: 1, order_type: 1, masa_pejabat: 1, sudah_disedia: 1, created_at: 1, masa_selesai: 1 })
      .toArray()) as OrderRow[];

    const orderIds = orders.map((o) => o.id);
    const allOrderItems = orderIds.length > 0
      ? ((await db.collection("order_items").find({ order_id: { $in: orderIds } }).project({ _id: 0, order_id: 1, item_id: 1, quantity: 1 }).toArray()) as OrderItemRow[])
      : [];

    const orderItemsByOrder = new Map<number, OrderItemRow[]>();
    for (const oi of allOrderItems) {
      const oid = oi.order_id;
      if (!orderItemsByOrder.has(oid)) orderItemsByOrder.set(oid, []);
      orderItemsByOrder.get(oid)!.push(oi);
    }

    const wards = (await db.collection("wards").find({}).project({ _id: 0, id: 1, name: 1, category: 1 }).toArray()) as WardRow[];

    const wardMap = new Map(
      wards.map((w) => [w.id, { name: w.name, category: w.category }])
    );

    const summaryMap = new Map<string, { ward_id: number; ward_name: string; order_type: string; order_count: number; bil_item: number; jumlah_item: number }>();
    const wardSummaryMap = new Map<number, { ward_id: number; ward_name: string; order_count: number; bil_item: number; jumlah_item: number }>();
    const masaMap = new Map<string, { order_count: number; bil_item: number; jumlah_item: number }>();
    const masaCatMap = new Map<string, { order_count: number; bil_item: number; jumlah_item: number }>();

    let totalQuantity = 0;
    let totalOrderCount = 0;
    let totalBilItem = 0;

    for (const order of orders) {
      const wardInfo = wardMap.get(Number(order.ward_id));
      const isMasaPejabat = order.masa_pejabat || false;
      const masaKey = isMasaPejabat ? "masa_pejabat" : "selepas_masa_pejabat";
      const wardId = Number(order.ward_id);
      const orderType = order.order_type;

      const orderItems = orderItemsByOrder.get(order.id) || [];

      const summaryKey = `${wardId}_${orderType}`;
      if (!summaryMap.has(summaryKey)) {
        summaryMap.set(summaryKey, {
          ward_id: wardId,
          ward_name: wardInfo?.name || "Unknown",
          order_type: orderType,
          order_count: 0,
          bil_item: 0,
          jumlah_item: 0,
        });
      }
      const summaryEntry = summaryMap.get(summaryKey)!;
      summaryEntry.order_count += 1;

      if (!wardSummaryMap.has(wardId)) {
        wardSummaryMap.set(wardId, {
          ward_id: wardId,
          ward_name: wardInfo?.name || "Unknown",
          order_count: 0,
          bil_item: 0,
          jumlah_item: 0,
        });
      }
      const wardEntry = wardSummaryMap.get(wardId)!;
      wardEntry.order_count += 1;

      if (!masaMap.has(masaKey)) {
        masaMap.set(masaKey, { order_count: 0, bil_item: 0, jumlah_item: 0 });
      }
      masaMap.get(masaKey)!.order_count += 1;

      const cat = wardInfo?.category || "unknown";
      const masaCatKey = `${cat}_${masaKey}`;
      if (!masaCatMap.has(masaCatKey)) {
        masaCatMap.set(masaCatKey, { order_count: 0, bil_item: 0, jumlah_item: 0 });
      }
      masaCatMap.get(masaCatKey)!.order_count += 1;

      for (const oi of orderItems) {
        const qty = oi.quantity;
        totalQuantity += qty;
        totalBilItem += 1;

        summaryEntry.bil_item += 1;
        summaryEntry.jumlah_item += qty;
        wardEntry.bil_item += 1;
        wardEntry.jumlah_item += qty;

        const masaStats = masaMap.get(masaKey)!;
        masaStats.bil_item += 1;
        masaStats.jumlah_item += qty;

        const masaCatStats = masaCatMap.get(masaCatKey)!;
        masaCatStats.bil_item += 1;
        masaCatStats.jumlah_item += qty;
      }
    }

    totalOrderCount = orders.length;

    let completedWithin120 = 0;
    let completedOver120 = 0;
    for (const order of orders) {
      if (order.sudah_disedia && order.masa_selesai && order.created_at) {
        const created = new Date(order.created_at).getTime();
        const finished = new Date(order.masa_selesai).getTime();
        const mins = Math.round((finished - created) / 60000);
        if (mins <= 120) {
          completedWithin120 += 1;
        } else {
          completedOver120 += 1;
        }
      }
    }
    const totalCompleted = completedWithin120 + completedOver120;

    const summary = Array.from(summaryMap.values())
      .sort((a, b) => a.ward_name.localeCompare(b.ward_name) || a.order_type.localeCompare(b.order_type));

    const totals_by_ward = Array.from(wardSummaryMap.values())
      .sort((a, b) => a.ward_name.localeCompare(b.ward_name));

    const totals_by_masa: Record<string, { order_count: number; bil_item: number; jumlah_item: number }> = {
      masa_pejabat: masaMap.get("masa_pejabat") || { order_count: 0, bil_item: 0, jumlah_item: 0 },
      selepas_masa_pejabat: masaMap.get("selepas_masa_pejabat") || { order_count: 0, bil_item: 0, jumlah_item: 0 },
    };

    const totals_by_masa_by_cat: Record<string, Record<string, { order_count: number; bil_item: number; jumlah_item: number }>> = {
      ward: {
        masa_pejabat: masaCatMap.get("ward_masa_pejabat") || { order_count: 0, bil_item: 0, jumlah_item: 0 },
        selepas_masa_pejabat: masaCatMap.get("ward_selepas_masa_pejabat") || { order_count: 0, bil_item: 0, jumlah_item: 0 },
      },
      not_ward: {
        masa_pejabat: masaCatMap.get("not_ward_masa_pejabat") || { order_count: 0, bil_item: 0, jumlah_item: 0 },
        selepas_masa_pejabat: masaCatMap.get("not_ward_selepas_masa_pejabat") || { order_count: 0, bil_item: 0, jumlah_item: 0 },
      },
    };

    return NextResponse.json(
      {
        type,
        start,
        end,
        summary,
        totals_by_ward,
        totals: { order_count: totalOrderCount, bil_item: totalBilItem, jumlah_item: totalQuantity },
        totals_by_masa,
        totals_by_masa_by_cat,
        timing: {
          completed_within_120: completedWithin120,
          completed_over_120: completedOver120,
          total_completed: totalCompleted,
          percentage_within_120: totalCompleted > 0 ? Math.round((completedWithin120 / totalCompleted) * 100) : 0,
        },
      },
      { headers: { "Cache-Control": "no-cache" } }
    );
  } catch (error) {
    console.error("GET /api/reports/usage error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan laporan penggunaan." },
      { status: 500 }
    );
  }
}
