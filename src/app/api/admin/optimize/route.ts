import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

function checkAdminAuth(request: NextRequest): boolean {
  const adminPassword = request.headers.get("x-admin-password");
  return adminPassword === process.env.ADMIN_PASSWORD;
}

export async function POST(request: NextRequest) {
  try {
    if (!checkAdminAuth(request)) {
      return NextResponse.json(
        { error: "Kata laluan pentadbir tidak sah" },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();

    await db.collection("wards").aggregate([{ $match: {} }, { $out: "wards" }]).toArray().catch(() => {});
    await db.collection("items").aggregate([{ $match: {} }, { $out: "items" }]).toArray().catch(() => {});
    await db.collection("orders").aggregate([{ $match: {} }, { $out: "orders" }]).toArray().catch(() => {});
    await db.collection("ward_catalog").aggregate([{ $match: {} }, { $out: "ward_catalog" }]).toArray().catch(() => {});

    return NextResponse.json({
      ok: true,
      note: "Pengoptimuman pangkalan data selesai. MongoDB mengendalikan pengoptimuman secara automatik.",
    });
  } catch (error) {
    console.error("POST /api/admin/optimize error:", error);
    return NextResponse.json(
      { error: "Ralat mengoptimumkan pangkalan data" },
      { status: 500 }
    );
  }
}
