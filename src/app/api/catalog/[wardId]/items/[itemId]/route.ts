import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

const catalogUpdateSchema = z.object({
  max_per_order: z.number().int().min(0),
  monthly_quota: z.number().int().min(0),
});

export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ wardId: string; itemId: string }>;
  }
) {
  try {
    const { wardId, itemId } = await params;
    const numberWardId = Number(wardId);
    const numberItemId = Number(itemId);
    const body = await request.json();
    const parsed = catalogUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const result = await db.collection("ward_catalog").findOneAndUpdate(
      { ward_id: numberWardId, item_id: numberItemId },
      {
        $set: {
          max_per_order: parsed.data.max_per_order,
          monthly_quota: parsed.data.monthly_quota,
        },
      }
    );

    if (!result) {
      return NextResponse.json(
        { error: "Entri katalog tidak ditemui" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/catalog/[wardId]/items/[itemId] error:", error);
    return NextResponse.json(
      { error: "Ralat mengemaskini katalog" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ wardId: string; itemId: string }>;
  }
) {
  try {
    const { wardId, itemId } = await params;
    const numberWardId = Number(wardId);
    const numberItemId = Number(itemId);
    const { db } = await connectToDatabase();

    const result = await db
      .collection("ward_catalog")
      .deleteOne({ ward_id: numberWardId, item_id: numberItemId });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Entri katalog tidak ditemui" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      "DELETE /api/catalog/[wardId]/items/[itemId] error:",
      error
    );
    return NextResponse.json(
      { error: "Ralat memadam katalog" },
      { status: 500 }
    );
  }
}
