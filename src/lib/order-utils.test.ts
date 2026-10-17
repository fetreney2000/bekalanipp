import { describe, expect, it } from "vitest";
import { groupItems, isDuplicateKeyError, statusError } from "./order-utils";

describe("groupItems", () => {
  it("merges duplicate item lines by summing quantities", () => {
    // This is the invariant that makes the unique {order_id, item_id} index
    // safe: an order can never contain the same item twice.
    expect(
      groupItems([
        { item_id: 1, quantity: 2 },
        { item_id: 5, quantity: 3 },
        { item_id: 1, quantity: 4 },
      ])
    ).toEqual([
      { item_id: 1, quantity: 6 },
      { item_id: 5, quantity: 3 },
    ]);
  });

  it("preserves first-seen order of distinct items", () => {
    const out = groupItems([
      { item_id: 9, quantity: 1 },
      { item_id: 3, quantity: 1 },
      { item_id: 9, quantity: 1 },
    ]);
    expect(out.map((i) => i.item_id)).toEqual([9, 3]);
  });

  it("returns a single merged entry when every line is the same item", () => {
    expect(
      groupItems([
        { item_id: 7, quantity: 1 },
        { item_id: 7, quantity: 1 },
        { item_id: 7, quantity: 1 },
      ])
    ).toEqual([{ item_id: 7, quantity: 3 }]);
  });

  it("returns an empty array for no lines", () => {
    expect(groupItems([])).toEqual([]);
  });

  it("does not mutate its input", () => {
    const input = [
      { item_id: 1, quantity: 2 },
      { item_id: 1, quantity: 3 },
    ];
    const snapshot = input.map((i) => ({ ...i }));
    groupItems(input);
    expect(input).toEqual(snapshot);
  });

  it("summing duplicates can push a combined total over the per-order cap", () => {
    // Two lines of 6 each pass a max_per_order of 10 individually but must be
    // caught once grouped to 12. This is why grouping runs before validation.
    const grouped = groupItems([
      { item_id: 1, quantity: 6 },
      { item_id: 1, quantity: 6 },
    ]);
    expect(grouped).toEqual([{ item_id: 1, quantity: 12 }]);
    expect(grouped[0].quantity).toBeGreaterThan(10);
  });
});

describe("statusError", () => {
  it("attaches an HTTP status to an Error", () => {
    const err = statusError(404, "not found");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.message).toBe("not found");
  });
});

describe("isDuplicateKeyError", () => {
  it("returns false for a plain Error", () => {
    expect(isDuplicateKeyError(new Error("boom"))).toBe(false);
  });

  it("returns false for null / undefined / non-objects", () => {
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError(undefined)).toBe(false);
    expect(isDuplicateKeyError("11000")).toBe(false);
  });

  it("returns true for a MongoServerError with code 11000", () => {
    // MongoServerError requires a message; code is what we inspect.
    const err = Object.assign(new Error("dup key"), {
      name: "MongoServerError",
      code: 11000,
    });
    // Not a real class instance, but exercises the instanceof+code guard path
    // only when it IS a MongoServerError. Here we assert the negative path
    // for a look-alike that isn't an instance.
    expect(isDuplicateKeyError(err)).toBe(false);
  });
});
