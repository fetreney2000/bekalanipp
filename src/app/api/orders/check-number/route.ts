import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get("order_number");
    const excludeId = searchParams.get("exclude_id");

    if (!orderNumber) {
      return NextResponse.json(
        { error: "Nombor pesanan diperlukan" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const filter: Record<string, unknown> = { order_number: orderNumber };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    const exists = await db.collection("orders").findOne(filter);

    return NextResponse.json({ exists: !!exists });
  } catch (error) {
    console.error("GET /api/orders/check-number error:", error);
    return NextResponse.json(
      { error: "Ralat menyemak nombor pesanan" },
      { status: 500 }
    );
  }
}
