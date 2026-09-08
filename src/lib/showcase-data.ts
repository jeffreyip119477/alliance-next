/**
 * A deterministic, realistic dataset used on a fresh install so the
 * calculator immediately demonstrates the full workflow.
 *
 * The scenario is intentionally different from the worked example in the
 * supplied reference image: it has six work packages and five tenderers.
 * Prices are in the application's currency units and each discount ladder is
 * indexed by final number of contracts won (DoP 1 = index 0).
 */

export interface ShowcaseDataset {
  contracts: number;
  tenderers: number;
  prices: number[][];
  discounts: number[][][];
  tendererNames: string[];
  contractNames: string[];
  useAverageDOP: boolean;
}

const ladder = (values: number[], contracts: number): number[][] =>
  Array.from({ length: contracts }, () => [...values]);

export const SHOWCASE_DATASET: ShowcaseDataset = {
  contracts: 6,
  tenderers: 5,
  tendererNames: [
    "Northstar Civil",
    "Meridian Build",
    "Harbour Engineering",
    "Summit Infrastructure",
    "Vertex Projects",
  ],
  contractNames: [
    "Contract 1",
    "Contract 2",
    "Contract 3",
    "Contract 4",
    "Contract 5",
    "Contract 6",
  ],
  prices: [
    // Northstar: wins the first package group when its volume discount is used.
    [160000, 165000, 170000, 480000, 460000, 440000],
    // Meridian: the strongest bidder for the second package group.
    [260000, 255000, 250000, 110000, 105000, 100000],
    // Harbour: credible mid-market alternate across every package.
    [210000, 215000, 220000, 240000, 235000, 230000],
    // Summit: lowest standalone bids for the first group, with no volume discount.
    [100000, 102000, 104000, 520000, 500000, 480000],
    // Vertex: a complete fifth tender to make the matrix and analytics useful.
    [340000, 335000, 330000, 300000, 295000, 290000],
  ],
  discounts: [
    ladder([0, 15, 40, 48, 54, 58], 6),
    ladder([0, 8, 25, 38, 46, 52], 6),
    ladder([0, 5, 12, 20, 28, 35], 6),
    ladder([0, 0, 0, 0, 0, 0], 6),
    ladder([0, 10, 18, 24, 30, 36], 6),
  ],
  // Showcase the application's average-DoP mode by default. The ladders are
  // intentionally consistent across contracts, so the expected best result
  // remains the same when users toggle this setting off.
  useAverageDOP: true,
};

/** Return a deep copy so React state and local edits never mutate the fixture. */
export const cloneShowcaseDataset = (): ShowcaseDataset => ({
  ...SHOWCASE_DATASET,
  prices: SHOWCASE_DATASET.prices.map((row) => [...row]),
  discounts: SHOWCASE_DATASET.discounts.map((row) =>
    row.map((tiers) => [...tiers])
  ),
  tendererNames: [...SHOWCASE_DATASET.tendererNames],
  contractNames: [...SHOWCASE_DATASET.contractNames],
});
