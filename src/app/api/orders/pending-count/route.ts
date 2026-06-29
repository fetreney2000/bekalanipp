import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const count = await db.collection("orders").countDocuments({ sudah_disedia: false });
    return NextResponse.json({ count });
  } catch (error) {
    console.error("GET /api/orders/pending-count error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan kiraan inden belum disediakan." },
      { status: 500 }
    );
  }
}
