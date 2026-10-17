import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/ensure-indexes";

export async function POST() {
  try {
    const { db } = await connectToDatabase();
    await ensureIndexes(db);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/indexes error:", error);
    return NextResponse.json(
      { error: "Ralat mencipta indeks." },
      { status: 500 }
    );
  }
}
