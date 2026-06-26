import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";
import { ObjectId } from "mongodb";

const itemUpdateSchema = z.object({
  name: z.string().min(1, "Nama item diperlukan"),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
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
      .findOne({ name: parsed.data.name, _id: { $ne: new ObjectId(id) } });
    if (existing) {
      return NextResponse.json(
        { error: "Nama item sudah wujud." },
        { status: 400 }
      );
    }

    const result = await db
      .collection("items")
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { name: parsed.data.name } },
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json(
        { error: "Item tidak ditemui" },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: result._id.toString(), name: result.name });
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

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const item = await db.collection("items").findOne({ _id: new ObjectId(id) });
    if (!item) {
      return NextResponse.json({ error: "Item tidak ditemui" }, { status: 404 });
    }

    const catalogCount = await db
      .collection("catalog")
      .countDocuments({ item_id: id });
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
      .collection("orders")
      .countDocuments({ "items.item_id": id });
    if (orderCount > 0) {
      return NextResponse.json(
        {
          error:
            "Tidak boleh padam: item masih digunakan dalam pesanan atau katalog.",
        },
        { status: 400 }
      );
    }

    await db.collection("items").deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/items/[id] error:", error);
    return NextResponse.json(
      { error: "Ralat memadam item" },
      { status: 500 }
    );
  }
}
