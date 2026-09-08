import { describe, expect, it } from "vitest";
import { normalizeHistoryItem } from "../infrastructure/persistence";

describe("history persistence normalization", () => {
  it("keeps the current snapshot shape", () => {
    const snapshot = {
      contracts: 1,
      tenderers: 1,
      prices: [[100]],
      discounts: [[[0]]],
      tendererNames: ["Tenderer 1"],
      contractNames: ["Contract 1"],
      selectedContracts: [],
      useAverageDOP: false,
      fastMode: false,
    };
    expect(
      normalizeHistoryItem({
        id: "h-1",
        savedAt: 123,
        name: "Saved",
        source: "random",
        snapshot,
      })
    ).toEqual({
      id: "h-1",
      savedAt: 123,
      name: "Saved",
      source: "random",
      snapshot,
    });
  });

  it("migrates the legacy selected-contract boolean array", () => {
    const item = normalizeHistoryItem({
      id: "legacy",
      timestamp: 456,
      contracts: 3,
      tenderers: 1,
      prices: [[100, 200, 300]],
      discounts: [[[0], [0], [0]]],
      selectedContracts: [true, false, true],
    });

    expect(item?.snapshot.selectedContracts).toEqual([0, 2]);
    expect(item?.snapshot.fastMode).toBe(false);
    expect(item?.source).toBe("manual");
  });

  it("drops malformed entries", () => {
    expect(normalizeHistoryItem(null)).toBeNull();
    expect(normalizeHistoryItem({ id: "missing-grid" })).toBeNull();
  });
});
