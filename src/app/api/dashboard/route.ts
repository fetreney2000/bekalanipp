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

    // Get total unique item count from orders this month
    const orderIds = ordersThisMonth.map((o: any) => o.id);
    const allOrderItems = orderIds.length > 0
      ? await db.collection("order_items").find({ order_id: { $in: orderIds } }).toArray()
      : [];

    const uniqueItemIds = new Set(allOrderItems.map((oi: any) => oi.item_id));

    // Calculate item usage for items with quotas using a single aggregation
    const quotaCatalogItems = catalogEntries.filter((c: any) => c.monthly_quota != null && c.monthly_quota > 0);
    const uniqueQuotaItemIds = [...new Set(quotaCatalogItems.map((c: any) => c.item_id))];

    // Batch compute usage per item for items with quotas
    const usageAggResults = orderIds.length > 0 && uniqueQuotaItemIds.length > 0
      ? await db.collection("order_items").aggregate([
          {
            $lookup: {
              from: "orders",
              localField: "order_id",
              foreignField: "id",
              as: "order",
            },
          },
          { $unwind: "$order" },
          {
            $match: {
              "order.order_date": { $gte: startOfMonth, $lte: endOfMonth },
              item_id: { $in: uniqueQuotaItemIds },
            },
          },
          { $group: { _id: "$item_id", total: { $sum: "$quantity" } } },
        ]).toArray()
      : [];

    const usageMap = new Map<number, number>();
    for (const r of usageAggResults) {
      usageMap.set(r._id, r.total || 0);
    }

    const itemStatus: {
      item_id: number;
      item_name: string;
      total_used: number;
      total_quota: number;
      wards_using: number;
      status: string;
    }[] = [];

    for (const item of allItems) {
      const itemCatalog = catalogEntries.filter((c: any) => c.item_id === item.id);
      const wardsUsing = itemCatalog.length;
      let totalQuota = 0;
      for (const cat of itemCatalog) {
        totalQuota += (cat as any).monthly_quota || 0;
      }

      const totalUsed = usageMap.get(item.id) || 0;

      let status = "normal";
      if (totalQuota > 0) {
        const ratio = totalUsed / totalQuota;
        if (ratio > 1) status = "melebihi";
        else if (ratio >= 0.8) status = "hampir_habis";
        else if (ratio >= 0.5) status = "sederhana";
      }

      itemStatus.push({
        item_id: item.id,
        item_name: item.name,
        total_used: totalUsed,
        total_quota: totalQuota,
        wards_using: wardsUsing,
        status,
      });
    }

    const warnings: string[] = [];
    const exceeded: string[] = [];

    for (const item of itemStatus) {
      if (item.status === "melebihi") {
        exceeded.push(
          `${item.item_name}: ${item.total_used}/${item.total_quota} telah dilampaui`
        );
      } else if (item.status === "hampir_habis") {
        warnings.push(
          `${item.item_name}: ${item.total_used}/${item.total_quota} hampir mencapai had`
        );
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
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan data papan pemuka" },
      { status: 500 }
    );
  }
}
