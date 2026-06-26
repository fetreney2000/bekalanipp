import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

const readySchema = z.object({
  sudah_disedia: z.boolean(),
});

export async function PATCH(
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
    const parsed = readySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const order = await db
      .collection("orders")
      .findOne({ id: numberId });

    if (!order) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemui" },
        { status: 404 }
      );
    }

    const sudahDisedia = parsed.data.sudah_disedia;
    const now = new Date();
    const updateFields: Record<string, unknown> = {
      sudah_disedia: sudahDisedia,
      updated_at: now.toISOString(),
    };

    let completionMinutes: number | null = null;
    let masaSelesai: string | null = null;

    if (sudahDisedia) {
      masaSelesai = now.toISOString();
      updateFields.masa_selesai = masaSelesai;

      if (order.created_at) {
        const createdAt = new Date(order.created_at);
        completionMinutes = Math.round(
          (now.getTime() - createdAt.getTime()) / 60000
        );
        updateFields.completion_minutes = completionMinutes;
      }
    } else {
      updateFields.completion_minutes = null;
      updateFields.masa_selesai = null;
    }

    await db
      .collection("orders")
      .updateOne({ id: numberId }, { $set: updateFields });

    return NextResponse.json({
      ok: true,
      id: numberId,
      sudah_disedia: sudahDisedia,
      completion_minutes: completionMinutes,
      masa_selesai: masaSelesai,
    });
  } catch (error) {
    console.error("PATCH /api/orders/[id]/ready error:", error);
    return NextResponse.json(
      { error: "Ralat mengemaskini status kesediaan" },
      { status: 500 }
    );
  }
}
