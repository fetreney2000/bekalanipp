import { MongoServerError } from "mongodb";

export interface OrderItemInput {
  item_id: number;
  quantity: number;
}

/**
 * Merge duplicate lines so per-item limits (max_per_order, monthly_quota)
 * are enforced against the true total for each item, not per line.
 */
export function groupItems(items: OrderItemInput[]): OrderItemInput[] {
  const map = new Map<number, number>();
  for (const it of items) {
    map.set(it.item_id, (map.get(it.item_id) || 0) + it.quantity);
  }
  return Array.from(map.entries()).map(([item_id, quantity]) => ({
    item_id,
    quantity,
  }));
}

/** Error carrying an HTTP status so route handlers can surface it verbatim. */
export function statusError(
  status: number,
  message: string
): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

/** True when MongoDB rejected a write due to a unique-index violation. */
export function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}
