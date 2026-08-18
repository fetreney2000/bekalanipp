import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

const quickRxSchema = z.object({
  quick_rx_record: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numberId = Number(id);

    if (isNaN(numberId)) {
      return NextResponse.json({ error: "ID tidak sah." }, { status: 400 });
    }

    const body = await request.json();
    const parsed = quickRxSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah." },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const existing = await db.collection("items").findOne({ id: numberId });
    if (!existing) {
      return NextResponse.json({ error: "Item tidak ditemui." }, { status: 404 });
    }

    await db
      .collection("items")
      .updateOne(
        { id: numberId },
        { $set: { quick_rx_record: parsed.data.quick_rx_record } }
      );

    return NextResponse.json({
      id: numberId,
      quick_rx_record: parsed.data.quick_rx_record,
    });
  } catch (error) {
    console.error("PATCH /api/items/[id]/quick-rx error:", error);
    return NextResponse.json(
      { error: "Ralat mengemaskini item." },
      { status: 500 }
    );
  }
}
