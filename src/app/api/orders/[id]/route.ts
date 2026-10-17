import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { groupItems, statusError, isDuplicateKeyError } from "@/lib/order-utils";
import { checkMaxPerOrder, checkMonthlyQuota, formatViolation } from "@/lib/quota";
import { ORDER_TYPES } from "@/lib/types";
import type { ItemRow, OrderItemRow } from "@/lib/types";
import { getMonthRange, isValidDate } from "@/lib/date-range";
import { z } from "zod";

type CounterDoc = { _id: string; seq: number };
type CatalogDoc = { item_id: number; max_per_order: number; monthly_quota: number | null };
type ItemDoc = { id: number; name: string };

const orderItemSchema = z.object({
  item_id: z.number().int(),
  quantity: z.number().int().min(1),
});

const orderUpdateSchema = z.object({
  order_date: z
    .string()
    .refine(isValidDate, { message: "Tarikh mesti berformat YYYY-MM-DD" }),
  order_number: z.string().min(1),
  order_type: z.enum(ORDER_TYPES),
  // Optional with NO default: if the client omits them we must not silently
  // overwrite with false (that's how a stale modal save reverted switches).
  masa_pejabat: z.boolean().optional(),
  masa_diterima: z.string().optional().nullable(),
  sudah_disedia: z.boolean().optional(),
  // Optimistic-lock token: the updated_at the client loaded. When present we
  // refuse the write if someone else changed the order underneath.
  expected_updated_at: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "Sekurang-kurangnya satu item diperlukan"),
});

async function getOrderItems(db: Awaited<ReturnType<typeof connectToDatabase>>["db"], orderId: number) {
  const orderItemsDocs = (await db
    .collection("order_items")
    .find({ order_id: orderId })
    .toArray()) as unknown as OrderItemRow[];
  const itemIds = [...new Set(orderItemsDocs.map((i) => i.item_id).filter(Boolean))];
  const itemDocs = itemIds.length > 0
    ? ((await db.collection("items").find({ id: { $in: itemIds } }).toArray()) as unknown as ItemRow[])
    : [];
  const itemMap = new Map(itemDocs.map((i) => [i.id, i.name]));
  const itemQuickRxMap = new Map(itemDocs.map((i) => [i.id, !!i.quick_rx_record]));
  return orderItemsDocs.map((item) => ({
    item_id: item.item_id,
    item_name: item.item_id != null ? itemMap.get(item.item_id) || "Unknown" : "Unknown",
    quantity: item.quantity,
    quick_rx_record: item.item_id != null ? itemQuickRxMap.get(item.item_id) || false : false,
  }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numberId = Number(id);

    if (isNaN(numberId)) {
      return NextResponse.json({ error: "ID tidak sah." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const order = await db.collection("orders").findOne({ id: numberId });

    if (!order) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemui." },
        { status: 404 }
      );
    }

    let wardName = "Unknown";
    if (order.ward_id != null) {
      const ward = await db.collection("wards").findOne({ id: Number(order.ward_id) });
      wardName = ward?.name || "Unknown";
    }

    const enrichedItems = await getOrderItems(db, numberId);

    return NextResponse.json(
      {
        id: order.id,
        ward_id: order.ward_id,
        ward_name: wardName,
        order_date: order.order_date,
        order_number: order.order_number,
        order_type: order.order_type,
        masa_pejabat: order.masa_pejabat || false,
        masa_diterima: order.masa_diterima || null,
        sudah_disedia: order.sudah_disedia || false,
        completion_minutes: order.completion_minutes || null,
        masa_selesai: order.masa_selesai || null,
        items: enrichedItems,
        created_at: order.created_at,
        updated_at: order.updated_at,
      },
      { headers: { "Cache-Control": "no-cache" } }
    );
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan pesanan." },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const parsed = orderUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak sah." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const { db, client } = await connectToDatabase();

    const existingOrder = await db
      .collection("orders")
      .findOne({ id: numberId });
    if (!existingOrder) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemui." },
        { status: 404 }
      );
    }

    const duplicateCheck = await db.collection("orders").findOne({
      order_number: data.order_number,
      id: { $ne: numberId },
    });
    if (duplicateCheck) {
      return NextResponse.json(
        { error: "Nombor pesanan sudah wujud." },
        { status: 400 }
      );
    }

    // Merge duplicate lines so limits are enforced against the true total.
    const items = groupItems(data.items);
    const itemIds = items.map((i) => i.item_id);

    const [catalogEntries, itemDocs] = await Promise.all([
      db.collection<CatalogDoc>("ward_catalog").find({ ward_id: existingOrder.ward_id, item_id: { $in: itemIds } }).toArray(),
      db.collection<ItemDoc>("items").find({ id: { $in: itemIds } }).toArray(),
    ]);
    const catalogMap = new Map<number, CatalogDoc>(catalogEntries.map((c) => [c.item_id, c]));
    const itemNameMap = new Map<number, string>(itemDocs.map((i) => [i.id, i.name]));
    const nameOf = (itemId: number) => itemNameMap.get(itemId) || String(itemId);

    // Catalog membership and per-order max don't depend on other orders,
    // so validate them up front for fast, friendly failures.
    for (const item of items) {
      const catalogEntry = catalogMap.get(item.item_id);
      if (!catalogEntry) {
        return NextResponse.json(
          { error: `Item "${nameOf(item.item_id)}" tidak tersedia dalam katalog wad ini.` },
          { status: 400 }
        );
      }
      const violation = checkMaxPerOrder(catalogEntry, item.quantity);
      if (violation) {
        return NextResponse.json(
          { error: formatViolation(violation, nameOf(item.item_id)) },
          { status: 400 }
        );
      }
    }

    const quotaItemIds = catalogEntries
      .filter((c) => c.monthly_quota != null && c.monthly_quota > 0)
      .map((c) => c.item_id);

    const orderMonth = data.order_date.slice(0, 7);
    const { start: startOfMonth, end: endOfMonth } = getMonthRange(orderMonth);

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        // Serialize concurrent edits for the same ward + month so the quota
        // check cannot race with another in-flight order.
        await db.collection<CounterDoc>("counters").findOneAndUpdate(
          { _id: `order_lock_${existingOrder.ward_id}_${startOfMonth.slice(0, 7)}` },
          { $inc: { seq: 1 } },
          { upsert: true, session }
        );

        // Re-check uniqueness inside the lock; the unique index on
        // order_number remains the final guard (E11000 handled below).
        const duplicate = await db.collection("orders").findOne(
          { order_number: data.order_number, id: { $ne: numberId } },
          { session }
        );
        if (duplicate) {
          throw statusError(400, "Nombor pesanan sudah wujud.");
        }

        // Read the month's usage (excluding this order) inside the
        // transaction so the quota check sees every other committed order.
        const monthlyUsageMap = new Map<number, number>();
        if (quotaItemIds.length > 0) {
          const monthlyOrderItems = await db
            .collection("order_items")
            .aggregate(
              [
                {
                  $lookup: {
                    from: "orders",
                    localField: "order_id",
                    foreignField: "id",
                    as: "order",
                  },
                },
                { $unwind: "$order" },
                {
                  $match: {
                    "order.ward_id": existingOrder.ward_id,
                    "order.order_date": { $gte: startOfMonth, $lte: endOfMonth },
                    "order.id": { $ne: numberId },
                    item_id: { $in: quotaItemIds },
                  },
                },
                { $group: { _id: "$item_id", total: { $sum: "$quantity" } } },
              ],
              { session }
            )
            .toArray();
          for (const row of monthlyOrderItems) {
            monthlyUsageMap.set(row._id, row.total);
          }
        }

        for (const item of items) {
          const catalogEntry = catalogMap.get(item.item_id);
          if (!catalogEntry) continue;

          const monthUsed = monthlyUsageMap.get(item.item_id) || 0;
          const violation = checkMonthlyQuota(catalogEntry, item.quantity, monthUsed);
          if (violation) {
            throw statusError(400, formatViolation(violation, nameOf(item.item_id)));
          }
        }

        const now = new Date().toISOString();

        // Optimistic lock: if the client loaded a specific version, only
        // write when the stored updated_at still matches. A mismatch means
        // another pharmacist edited this inden since the modal was opened.
        const filter: Record<string, unknown> = { id: numberId };
        if (data.expected_updated_at) {
          filter.updated_at = data.expected_updated_at;
        }

        // Only touch the two status flags the client actually sent — omitting
        // one must not silently reset it to false.
        const setStatus: Record<string, unknown> = {
          order_date: data.order_date,
          order_number: data.order_number,
          order_type: data.order_type,
          masa_diterima: data.masa_diterima || null,
          updated_at: now,
        };
        if (data.masa_pejabat !== undefined) setStatus.masa_pejabat = data.masa_pejabat;
        if (data.sudah_disedia !== undefined) setStatus.sudah_disedia = data.sudah_disedia;

        const updateResult = await db.collection("orders").updateOne(
          filter,
          { $set: setStatus },
          { session }
        );

        if (updateResult.matchedCount === 0) {
          // Distinguish "never existed" from "someone else changed it first".
          const stillThere = await db
            .collection("orders")
            .findOne({ id: numberId }, { session });
          if (!stillThere) {
            throw statusError(404, "Pesanan tidak dijumpai.");
          }
          throw statusError(
            409,
            "Inden ini telah dikemas kini oleh pengguna lain. Muat semula dan cuba lagi."
          );
        }

        await db.collection("order_items").deleteMany({ order_id: numberId }, { session });
        await db.collection("order_items").insertMany(
          items.map((i) => ({
            order_id: numberId,
            item_id: i.item_id,
            quantity: i.quantity,
          })),
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "Nombor pesanan sudah wujud." },
        { status: 400 }
      );
    }
    const status = (error as { status?: number })?.status;
    if (status === 400 || status === 404 || status === 409) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status }
      );
    }
    console.error("PUT /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: "Ralat mengemaskini pesanan." },
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
      return NextResponse.json({ error: "ID tidak sah." }, { status: 400 });
    }

    const { db, client } = await connectToDatabase();

    // Delete items and header in one transaction so a failure can't leave
    // orphaned order_items behind.
    const session = client.startSession();
    let existed = false;
    try {
      await session.withTransaction(async () => {
        const result = await db
          .collection("orders")
          .deleteOne({ id: numberId }, { session });
        existed = result.deletedCount > 0;
        await db.collection("order_items").deleteMany({ order_id: numberId }, { session });
      });
    } finally {
      await session.endSession();
    }

    if (!existed) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemui." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: "Ralat memadam pesanan." },
      { status: 500 }
    );
  }
}
