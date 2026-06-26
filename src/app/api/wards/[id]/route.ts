import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

const wardUpdateSchema = z.object({
  name: z.string().min(1, "Nama wad/jabatan diperlukan"),
  category: z.enum(["ward", "not_ward"]),
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
    const parsed = wardUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const existing = await db
      .collection("wards")
      .findOne({ name: parsed.data.name, id: { $ne: numberId } });
    if (existing) {
      return NextResponse.json(
        { error: "Nama wad/jabatan sudah wujud." },
        { status: 400 }
      );
    }

    const result = await db
      .collection("wards")
      .findOneAndUpdate(
        { id: numberId },
        { $set: { name: parsed.data.name, category: parsed.data.category } },
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json(
        { error: "Wad/jabatan tidak ditemui" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: result.id,
      name: result.name,
      category: result.category,
    });
  } catch (error) {
    console.error("PUT /api/wards/[id] error:", error);
    return NextResponse.json(
      { error: "Ralat mengemaskini wad/jabatan" },
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

    const ward = await db.collection("wards").findOne({ id: numberId });
    if (!ward) {
      return NextResponse.json(
        { error: "Wad/jabatan tidak ditemui" },
        { status: 404 }
      );
    }

    const orderCount = await db
      .collection("orders")
      .countDocuments({ ward_id: numberId });
    if (orderCount > 0) {
      return NextResponse.json(
        {
          error:
            "Tidak boleh padam: wad/jabatan masih mempunyai rekod pesanan.",
        },
        { status: 400 }
      );
    }

    await db.collection("ward_catalog").deleteMany({ ward_id: numberId });
    await db.collection("wards").deleteOne({ id: numberId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/wards/[id] error:", error);
    return NextResponse.json(
      { error: "Ralat memadam wad/jabatan" },
      { status: 500 }
    );
  }
}
