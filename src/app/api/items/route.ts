import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

const itemSchema = z.object({
  name: z.string().min(1, "Nama item diperlukan"),
});

export async function GET(_request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const items = await db
      .collection("items")
      .find({})
      .project({ _id: 0, id: 1, name: 1 })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json(
      items.map((item) => ({
        id: item.id,
        name: item.name,
      })),
      { headers: { "Cache-Control": "no-cache" } }
    );
  } catch (error) {
    console.error("GET /api/items error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan senarai item." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = itemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah." },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const existing = await db
      .collection("items")
      .findOne({ name: parsed.data.name });
    if (existing) {
      return NextResponse.json(
        { error: "Nama item sudah wujud." },
        { status: 400 }
      );
    }

    const counter = await db.collection("counters").findOneAndUpdate(
      { _id: "items" } as any,
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const nextId = counter?.seq ?? 1;

    await db.collection("items").insertOne({
      id: nextId,
      name: parsed.data.name,
    });

    return NextResponse.json(
      { id: nextId, name: parsed.data.name },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/items error:", error);
    return NextResponse.json({ error: "Ralat mencipta item." }, { status: 500 });
  }
}
