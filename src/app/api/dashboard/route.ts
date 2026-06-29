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

    const wards = await db.collection("wards").find({}).sort({ name: 1 }).toArray();
    const catalogEntries = await db.collection("ward_catalog").find({}).toArray();

    const ordersThisMonth = await db
      .collection("orders")
      .find({ order_date: { $gte: startOfMonth, $lte: endOfMonth } })
      .toArray();

    const ordersCount = ordersThisMonth.length;
    const allItems = await db.collection("items").find({}).sort({ name: 1 }).toArray();
    const itemsCount = allItems.length;

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

    const uniqueOrderItemPairs: { ward_id: number; item_id: number }[] = [];
    if (orderIds.length > 0) {
      const allOrderItems = await db
        .collection("order_items")
        .find({ order_id: { $in: orderIds } })
        .toArray();

      const orderMap = new Map<number, any>();
      for (const o of ordersThisMonth) {
        orderMap.set(o.id, o);
      }

      const usageMap = new Map<string, number>();
      for (const oi of allOrderItems) {
        const order = orderMap.get(oi.order_id);
        if (!order) continue;
        const key = `${order.ward_id}:${oi.item_id}`;
        usageMap.set(key, (usageMap.get(key) || 0) + (oi.quantity || 0));
      }

      const itemStatus: { ward_name: string; item_name: string; quota: number; used: number }[] = [];

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

      itemStatus.sort((a, b) =>
        a.ward_name.localeCompare(b.ward_name) || a.item_name.localeCompare(b.item_name)
      );

      const warnings: typeof itemStatus = [];
      const exceeded: typeof itemStatus = [];

      for (const item of itemStatus) {
        if (item.quota > 0 && item.used >= item.quota) {
          exceeded.push(item);
        } else if (item.quota > 0 && item.used >= item.quota * 0.8) {
          warnings.push(item);
        }
      }

      const wardUsage: { ward_id: number; ward_name: string; order_count: number }[] = [];
      for (const ward of wards) {
        const wardOrders = ordersThisMonth.filter((o: any) => o.ward_id === ward.id);
        wardUsage.push({
          ward_id: ward.id,
          ward_name: ward.name,
          order_count: wardOrders.length,
        });
      }
      wardUsage.sort((a, b) => b.order_count - a.order_count);
      const topWard = wardUsage[0] || null;

      return NextResponse.json({
        month: monthStr,
        itemStatus,
        warnings,
        exceeded,
        orders_count: ordersCount,
        items_count: itemsCount,
        top_ward: topWard,
      });
    }

    const itemStatus: { ward_name: string; item_name: string; quota: number; used: number }[] = [];

    for (const cat of wardsWithQuota) {
      const wardName = wardMap.get(cat.ward_id) || "Unknown";
      const itemName = itemMap.get(cat.item_id) || "Unknown";

      itemStatus.push({
        ward_name: wardName,
        item_name: itemName,
        quota: cat.monthly_quota,
        used: 0,
      });
    }

    itemStatus.sort((a, b) =>
      a.ward_name.localeCompare(b.ward_name) || a.item_name.localeCompare(b.item_name)
    );

    const wardUsage2: { ward_id: number; ward_name: string; order_count: number }[] = [];
    for (const ward of wards) {
      const wardOrders = ordersThisMonth.filter((o: any) => o.ward_id === ward.id);
      wardUsage2.push({
        ward_id: ward.id,
        ward_name: ward.name,
        order_count: wardOrders.length,
      });
    }
    wardUsage2.sort((a, b) => b.order_count - a.order_count);
    const topWard2 = wardUsage2[0] || null;

    return NextResponse.json({
      month: monthStr,
      itemStatus,
      warnings: [],
      exceeded: [],
      orders_count: ordersCount,
      items_count: itemsCount,
      top_ward: topWard2,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan data papan pemuka." },
      { status: 500 }
    );
  }
}
