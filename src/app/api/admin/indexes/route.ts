import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

export async function POST() {
  try {
    const { db } = await connectToDatabase();

    await Promise.all([
      db.collection("orders").createIndex({ order_date: -1 }),
      db.collection("orders").createIndex({ order_number: 1 }, { unique: true }),
      db.collection("orders").createIndex({ ward_id: 1 }),
      db.collection("orders").createIndex({ id: 1 }, { unique: true }),
      db.collection("order_items").createIndex({ order_id: 1 }),
      db.collection("order_items").createIndex({ item_id: 1 }),
      db.collection("wards").createIndex({ id: 1 }, { unique: true }),
      db.collection("items").createIndex({ id: 1 }, { unique: true }),
      db.collection("ward_catalog").createIndex(
        { ward_id: 1, item_id: 1 },
        { unique: true }
      ),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/indexes error:", error);
    return NextResponse.json(
      { error: "Ralat mencipta indeks." },
      { status: 500 }
    );
  }
}
