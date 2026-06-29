import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

const masaPejabatSchema = z.object({
  masa_pejabat: z.boolean(),
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
    const parsed = masaPejabatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah." },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const result = await db
      .collection("orders")
      .findOneAndUpdate(
        { id: numberId },
        {
          $set: {
            masa_pejabat: parsed.data.masa_pejabat,
            updated_at: new Date().toISOString(),
          },
        },
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemui." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: numberId,
      masa_pejabat: result.masa_pejabat,
    });
  } catch (error) {
    console.error("PATCH /api/orders/[id]/masa-pejabat error:", error);
    return NextResponse.json(
      { error: "Ralat mengemaskini status masa pejabat." },
      { status: 500 }
    );
  }
}
