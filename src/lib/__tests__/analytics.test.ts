import { describe, it, expect } from "vitest";
import { computeWinStats } from "../analytics";
import type { Results, Combination } from "../alliance-combinations";

// ---------------------------------------------------------------------------
// Hand-crafted minimal Results: 2 contracts, 2 active tenderers (+ 1 inactive
// when tCount=3). computeWinStats only reads `combinations` and
// `totalCombos`, but we build a full well-formed literal.
//
// combos (sorted by total):
//   c0: [A, B] -> counts [1,1]  total 190  (Global Best, niche)
//   c1: [A, A] -> counts [2,0]  total 200
//   c2: [B, B] -> counts [0,2]  total 220
//
// Hand-computed expectations (tCount = 3, so tenderer 2 is always 0):
//   tenderer 0: counts [1,2,0] -> winsInCombos 2, totalWins 3, avg 1,
//                  winRate 2/3, timesTop 2 (ties c0 max, tops c1)
//   tenderer 1: counts [1,0,2] -> winsInCombos 2, totalWins 3, avg 1,
//                  winRate 2/3, timesTop 2 (ties c0 max, tops c2)
//   tenderer 2: counts [0,0,0] -> all zero, timesTop 0 (max is always >= 1)
// ---------------------------------------------------------------------------

const combos: Combination[] = [
  {
    assignment: [0, 1],
    contractCosts: [100, 90],
    total: 190,
    tendererCounts: [1, 1],
    isGlobalBest: true,
    isNicheOptimization: true,
  },
  {
    assignment: [0, 0],
    contractCosts: [100, 100],
    total: 200,
    tendererCounts: [2, 0],
  },
  {
    assignment: [1, 1],
    contractCosts: [110, 110],
    total: 220,
    tendererCounts: [0, 2],
  },
];

const mkResults = (cs: Combination[], totalCombos: number): Results => ({
  totalLowestBase: 210,
  totalSelectedDiscounted: cs[0]?.total ?? 0,
  costSaving: 20,
  combinations: cs,
  bestCombo: cs[0] ?? null,
  nicheCombos: cs.filter((c) => c.isNicheOptimization),
  totalCombos,
  prices: [
    [100, 100],
    [110, 110],
  ],
  discounts: [
    [
      [0, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [0, 0],
    ],
  ],
  stats: { nodesVisited: 12, leavesEvaluated: 4, prunedNodes: 8, elapsedMs: 1 },
});

describe("computeWinStats", () => {
  it("matches hand-computed expectations on the crafted 2-contract result", () => {
    const stats = computeWinStats(mkResults(combos, 3), 3);
    expect(stats).toHaveLength(3);

    const [a, b, c] = stats;
    expect(a.tenderer).toBe(0);
    expect(a.winsInCombos).toBe(2);
    expect(a.winRate).toBeCloseTo(2 / 3);
    expect(a.avgWinCount).toBeCloseTo(1);
    expect(a.totalWins).toBe(3);
    expect(a.timesTop).toBe(2);

    expect(b.tenderer).toBe(1);
    expect(b.winsInCombos).toBe(2);
    expect(b.winRate).toBeCloseTo(2 / 3);
    expect(b.avgWinCount).toBeCloseTo(1);
    expect(b.totalWins).toBe(3);
    expect(b.timesTop).toBe(2);

    // Inactive tenderer (beyond the counts array length): everything zero.
    expect(c).toEqual({
      tenderer: 2,
      winsInCombos: 0,
      winRate: 0,
      avgWinCount: 0,
      totalWins: 0,
      timesTop: 0,
    });
  });

  it("uses totalCombos for winRate and the enumerated combos for avgWinCount", () => {
    // Same combos, but declare totalCombos = 4: winRate halves, avg unchanged.
    const stats = computeWinStats(mkResults(combos, 4), 2);
    expect(stats[0].winRate).toBeCloseTo(0.5);
    expect(stats[1].winRate).toBeCloseTo(0.5);
    expect(stats[0].avgWinCount).toBeCloseTo(1);
    expect(stats[0].totalWins).toBe(3);
  });

  it("returns all zeros (no NaN) for an empty result", () => {
    const stats = computeWinStats(mkResults([], 0), 2);
    expect(stats).toHaveLength(2);
    for (const s of stats) {
      expect(s.winsInCombos).toBe(0);
      expect(s.winRate).toBe(0);
      expect(s.avgWinCount).toBe(0);
      expect(s.totalWins).toBe(0);
      expect(s.timesTop).toBe(0);
    }
  });

  it("is pure: repeated calls give identical output", () => {
    const r = mkResults(combos, 3);
    expect(computeWinStats(r, 3)).toEqual(computeWinStats(r, 3));
  });
});
