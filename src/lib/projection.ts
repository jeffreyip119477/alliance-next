// Scenario projection: reduce a full price/discount grid to the subset of
// selected contracts, reindexing each tenderer's DoP ladders to length k.
//
// Rationale (final-count DoP semantics): a tenderer can win at most k
// contracts in a k-contract scenario, so tiers >= k are unreachable.
// Reindexing also makes the engine's niche threshold (ceil(cCount/2)) use
// the selected count k instead of the full pack size — the correct semantics
// for partial scenarios.
//
// The projection is pure data shaping; generateResults then receives
// cCount = k and treats the projected grid as a standalone problem.

export interface ProjectionResult {
  prices: number[][];
  discounts: number[][][];
  /** Selected contract count k. */
  cCount: number;
  /** indexMap[newIdx] = original contract index. */
  indexMap: number[];
  forced?: (number | null)[];
  forbidden?: boolean[][];
}

export const projectToSelectedContracts = (
  prices: number[][],
  discounts: number[][][],
  selectedIndices: number[],
  forced?: (number | null)[],
  forbidden?: boolean[][]
): ProjectionResult => {
  const k = selectedIndices.length;
  const m = prices.length;

  const newPrices: number[][] = Array.from({ length: m }, (_, t) =>
    selectedIndices.map((c) => prices[t]?.[c] ?? 0)
  );

  const newDiscounts: number[][][] = Array.from({ length: m }, (_, t) =>
    selectedIndices.map((c) => {
      const ladder = discounts[t]?.[c] ?? [];
      // Wins are capped at k, so only tiers 0..k-1 can ever be reached.
      return Array.from({ length: k }, (_, d) => ladder[d] ?? 0);
    })
  );

  const newForced: (number | null)[] | undefined = forced
    ? selectedIndices.map((c) => forced[c] ?? null)
    : undefined;

  const newForbidden: boolean[][] | undefined = forbidden
    ? Array.from({ length: m }, (_, t) =>
        selectedIndices.map((c) => forbidden[t]?.[c] === true)
      )
    : undefined;

  return {
    prices: newPrices,
    discounts: newDiscounts,
    cCount: k,
    indexMap: [...selectedIndices],
    forced: newForced,
    forbidden: newForbidden,
  };
};
