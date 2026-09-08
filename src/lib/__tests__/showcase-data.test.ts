import { describe, expect, it } from "vitest";
import { generateResults } from "../alliance-combinations";
import { cloneShowcaseDataset, SHOWCASE_DATASET } from "../showcase-data";

describe("built-in showcase dataset", () => {
  it("covers every contract with a complete bid and discount matrix", () => {
    const { prices, discounts, contracts, tenderers } = SHOWCASE_DATASET;

    expect(contracts).toBe(6);
    expect(tenderers).toBe(5);
    expect(SHOWCASE_DATASET.contractNames).toEqual([
      "Contract 1",
      "Contract 2",
      "Contract 3",
      "Contract 4",
      "Contract 5",
      "Contract 6",
    ]);
    expect(SHOWCASE_DATASET.useAverageDOP).toBe(true);
    expect(prices).toHaveLength(tenderers);
    expect(discounts).toHaveLength(tenderers);

    for (let c = 0; c < contracts; c++) {
      expect(prices.some((row) => row[c] > 0)).toBe(true);
      for (let t = 0; t < tenderers; t++) {
        expect(discounts[t][c]).toHaveLength(contracts);
        expect(discounts[t][c].every((value) => value >= 0 && value <= 100)).toBe(true);
      }
    }
  });

  it("finds the volume-discount split across all six contracts", () => {
    const d = cloneShowcaseDataset();
    const result = generateResults(
      d.prices,
      d.discounts,
      d.contracts,
      d.tenderers,
      d.useAverageDOP
    );

    expect(result.totalLowestBase).toBe(621000);
    expect(result.bestCombo?.assignment).toEqual([0, 0, 0, 1, 1, 1]);
    expect(result.bestCombo?.tendererCounts).toEqual([3, 3, 0, 0, 0]);
    expect(result.bestCombo?.contractCosts).toEqual([
      96000,
      99000,
      102000,
      82500,
      78750,
      75000,
    ]);
    expect(result.totalSelectedDiscounted).toBe(533250);
    expect(result.costSaving).toBe(87750);
    expect(result.totalCombos).toBe(2);

    // The result must be valid for every contract, not just the aggregate.
    const standaloneFloor = [100000, 102000, 104000, 110000, 105000, 100000];
    for (const combo of result.combinations) {
      expect(combo.contractCosts.every((cost, c) => cost <= standaloneFloor[c])).toBe(true);
      expect(combo.total).toBeLessThanOrEqual(result.totalLowestBase);
    }
  });

  it("returns independent copies for editable React state", () => {
    const a = cloneShowcaseDataset();
    const b = cloneShowcaseDataset();
    a.prices[0][0] = 1;
    a.discounts[0][0][1] = 99;
    a.tendererNames[0] = "Edited";

    expect(b.prices[0][0]).toBe(160000);
    expect(b.discounts[0][0][1]).toBe(15);
    expect(b.tendererNames[0]).toBe("Northstar Civil");
    expect(b.contractNames[0]).toBe("Contract 1");
  });
});
