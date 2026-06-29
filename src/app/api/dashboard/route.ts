import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    const { db } = await connectToDatabase();

    let startOfMonth: string;
    let endOfMonth: string;
    let monthStr: string;

    if (month) {
      monthStr = month;
      const [yearStr, mStr] = month.split("-");
      const year = parseInt(yearStr);
      const m = parseInt(mStr);
      startOfMonth = `${month}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      endOfMonth = `${month}-${String(lastDay).padStart(2, "0")}`;
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const m = now.getMonth() + 1;
      monthStr = `${year}-${String(m).padStart(2, "0")}`;
      startOfMonth = `${monthStr}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      endOfMonth = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
    }

    const [wards, catalogEntries, ordersThisMonth] = await Promise.all([
      db.collection("wards").find({}).project({ _id: 0, id: 1, name: 1 }).sort({ name: 1 }).toArray(),
      db.collection("ward_catalog").find({}).project({ _id: 0, ward_id: 1, item_id: 1, monthly_quota: 1, max_per_order: 1 }).toArray(),
      db.collection("orders")
        .find({ order_date: { $gte: startOfMonth, $lte: endOfMonth } })
        .project({ _id: 0, id: 1, ward_id: 1, order_date: 1, order_type: 1 })
        .toArray(),
    ]);

    const ordersCount = ordersThisMonth.length;
    const itemIdsWithQuota = [...new Set(catalogEntries.filter((c: any) => c.monthly_quota > 0).map((c: any) => c.item_id))];
    const allItems = itemIdsWithQuota.length > 0
      ? await db.collection("items").find({ id: { $in: itemIdsWithQuota } }).project({ _id: 0, id: 1, name: 1 }).sort({ name: 1 }).toArray()
      : [];
    const itemsCount = await db.collection("items").countDocuments();

    const orderIds = ordersThisMonth.map((o: any) => o.id);

    const wardMap = new Map<number, string>();
    for (const w of wards) {
      wardMap.set(w.id, w.name);
    }

    const itemMap = new Map<number, string>();
    for (const i of allItems) {
      itemMap.set(i.id, i.name);
    }

    const wardsWithQuota = catalogEntries.filter(
      (c: any) => c.monthly_quota != null && c.monthly_quota > 0
    );

    let usageMap = new Map<string, number>();
    if (orderIds.length > 0) {
      const allOrderItems = await db
        .collection("order_items")
        .find({ order_id: { $in: orderIds } })
        .project({ _id: 0, order_id: 1, item_id: 1, quantity: 1 })
        .toArray();

      const orderMap = new Map<number, any>();
      for (const o of ordersThisMonth) {
        orderMap.set(o.id, o);
      }

      for (const oi of allOrderItems) {
        const order = orderMap.get(oi.order_id);
        if (!order) continue;
        const key = `${order.ward_id}:${oi.item_id}`;
        usageMap.set(key, (usageMap.get(key) || 0) + (oi.quantity || 0));
      }
    }

    const itemStatus: { ward_name: string; item_name: string; quota: number; used: number }[] = [];
    for (const cat of wardsWithQuota) {
      const wardName = wardMap.get(cat.ward_id) || "Unknown";
      const itemName = itemMap.get(cat.item_id) || "Unknown";
      const key = `${cat.ward_id}:${cat.item_id}`;
      const used = usageMap.get(key) || 0;
      itemStatus.push({ ward_name: wardName, item_name: itemName, quota: cat.monthly_quota, used });
    }
    itemStatus.sort((a, b) => a.ward_name.localeCompare(b.ward_name) || a.item_name.localeCompare(b.item_name));

    const warnings: typeof itemStatus = [];
    const exceeded: typeof itemStatus = [];
    for (const item of itemStatus) {
      if (item.quota > 0 && item.used >= item.quota) exceeded.push(item);
      else if (item.quota > 0 && item.used >= item.quota * 0.8) warnings.push(item);
    }

    const wardCounts = new Map<number, number>();
    for (const o of ordersThisMonth) {
      wardCounts.set(Number(o.ward_id), (wardCounts.get(Number(o.ward_id)) || 0) + 1);
    }
    let topWard = null;
    for (const ward of wards) {
      const count = wardCounts.get(ward.id) || 0;
      if (!topWard || count > topWard.order_count) {
        topWard = { ward_id: ward.id, ward_name: ward.name, order_count: count };
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
