import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

function checkAdminAuth(request: NextRequest): boolean {
  const adminPassword = request.headers.get("x-admin-password");
  return adminPassword === process.env.ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  try {
    if (!checkAdminAuth(request)) {
      return NextResponse.json(
        { error: "Kata laluan pentadbir tidak sah" },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await (db.collection("config") as any).findOne({ _id: "maintenance" });

    const wardsCount = await db.collection("wards").countDocuments();
    const itemsCount = await db.collection("items").countDocuments();
    const ordersCount = await db.collection("orders").countDocuments();
    const catalogCount = await db.collection("catalog").countDocuments();

    const nextBackup = new Date();
    nextBackup.setDate(nextBackup.getDate() + 1);
    nextBackup.setHours(3, 0, 0, 0);

    return NextResponse.json({
      ok: true,
      config: config?.settings || {
        auto_backup: true,
        backup_interval_hours: 24,
        retention_days: 30,
      },
      sizes: {
        wards: wardsCount,
        items: itemsCount,
        orders: ordersCount,
        catalog: catalogCount,
      },
      nextBackup: nextBackup.toISOString(),
    });
  } catch (error) {
    console.error("GET /api/admin/maintenance error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan data penyelenggaraan" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!checkAdminAuth(request)) {
      return NextResponse.json(
        { error: "Kata laluan pentadbir tidak sah" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { db } = await connectToDatabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.collection("config") as any).updateOne(
      { _id: "maintenance" },
      { $set: { settings: body } },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, config: body });
  } catch (error) {
    console.error("POST /api/admin/maintenance error:", error);
    return NextResponse.json(
      { error: "Ralat menyimpan konfigurasi penyelenggaraan" },
      { status: 500 }
    );
  }
}
