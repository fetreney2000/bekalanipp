import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

const wardSchema = z.object({
  name: z.string().min(1, "Nama wad/jabatan diperlukan"),
  category: z.enum(["ward", "not_ward"]).default("ward"),
});

export async function GET(_request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const wards = await db
      .collection("wards")
      .find({})
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json(
      wards.map((w) => ({
        id: w.id,
        name: w.name,
        category: w.category,
      })),
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("GET /api/wards error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan senarai wad/jabatan." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = wardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah." },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const existing = await db.collection("wards").findOne({ name: parsed.data.name });
    if (existing) {
      return NextResponse.json(
        { error: "Nama wad/jabatan sudah wujud." },
        { status: 400 }
      );
    }

    const counter = await db.collection("counters").findOneAndUpdate(
      { _id: "wards" } as any,
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const nextId = counter?.seq ?? 1;

    await db.collection("wards").insertOne({
      id: nextId,
      name: parsed.data.name,
      category: parsed.data.category,
    });

    return NextResponse.json(
      {
        id: nextId,
        name: parsed.data.name,
        category: parsed.data.category,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/wards error:", error);
    return NextResponse.json(
      { error: "Ralat mencipta wad/jabatan." },
      { status: 500 }
    );
  }
}
