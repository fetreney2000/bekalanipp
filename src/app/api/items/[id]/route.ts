import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

const itemUpdateSchema = z.object({
  name: z.string().min(1, "Nama item diperlukan"),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numberId = Number(id);

    if (isNaN(numberId)) {
      return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = itemUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const existing = await db
      .collection("items")
      .findOne({ name: parsed.data.name, id: { $ne: numberId } });
    if (existing) {
      return NextResponse.json(
        { error: "Nama item sudah wujud." },
        { status: 400 }
      );
    }

    const result = await db
      .collection("items")
      .findOneAndUpdate(
        { id: numberId },
        { $set: { name: parsed.data.name } },
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json(
        { error: "Item tidak ditemui" },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: result.id, name: result.name });
  } catch (error) {
    console.error("PUT /api/items/[id] error:", error);
    return NextResponse.json(
      { error: "Ralat mengemaskini item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numberId = Number(id);

    if (isNaN(numberId)) {
      return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const item = await db.collection("items").findOne({ id: numberId });
    if (!item) {
      return NextResponse.json({ error: "Item tidak ditemui" }, { status: 404 });
    }

    const catalogCount = await db
      .collection("ward_catalog")
      .countDocuments({ item_id: numberId });
    if (catalogCount > 0) {
      return NextResponse.json(
        {
          error:
            "Tidak boleh padam: item masih digunakan dalam pesanan atau katalog.",
        },
        { status: 400 }
      );
    }

    const orderCount = await db
      .collection("order_items")
      .countDocuments({ item_id: numberId });
    if (orderCount > 0) {
      return NextResponse.json(
        {
          error:
            "Tidak boleh padam: item masih digunakan dalam pesanan atau katalog.",
        },
        { status: 400 }
      );
    }

    await db.collection("items").deleteOne({ id: numberId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/items/[id] error:", error);
    return NextResponse.json(
      { error: "Ralat memadam item" },
      { status: 500 }
    );
  }
}
