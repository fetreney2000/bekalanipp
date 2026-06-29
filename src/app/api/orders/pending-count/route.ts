import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const count = await db.collection("orders").countDocuments({ sudah_disedia: false });
    return NextResponse.json(
      { count },
      { headers: { "Cache-Control": "s-maxage=10" } }
    );
  } catch (error) {
    console.error("GET /api/orders/pending-count error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan kiraan inden belum disediakan." },
      { status: 500 }
    );
  }
}
