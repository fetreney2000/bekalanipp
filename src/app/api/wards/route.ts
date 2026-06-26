import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";
import { ObjectId } from "mongodb";

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
        id: w._id.toString(),
        name: w.name,
        category: w.category,
      }))
    );
  } catch (error) {
    console.error("GET /api/wards error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan senarai wad/jabatan" },
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
        { error: parsed.error.issues[0]?.message || "Data tidak sah" },
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

    const result = await db.collection("wards").insertOne({
      name: parsed.data.name,
      category: parsed.data.category,
    });

    return NextResponse.json(
      {
        id: result.insertedId.toString(),
        name: parsed.data.name,
        category: parsed.data.category,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/wards error:", error);
    return NextResponse.json(
      { error: "Ralat mencipta wad/jabatan" },
      { status: 500 }
    );
  }
}
