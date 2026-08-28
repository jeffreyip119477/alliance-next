// Pure result-calculation engine for the alliance combinations tool.
// Extracted from useAllianceCombinations.ts so it can be unit-tested directly.
//
// DoP semantics (FINAL-COUNT): if a tenderer wins k contracts in a combination,
// every one of those k contracts is priced at discount tier index k-1.
// Pruning uses an ADMISSIBLE lower bound (per-contract floor = cheapest possible
// cost after the deepest reachable discount), so no valid combination can be
// pruned away — unlike the old sequential-cost pruning, which could discard
// leaves whose true final-count total was under the ceiling.

export interface Combination {
  assignment: number[];
  contractCosts: number[];
  total: number;
  tendererCounts: number[];
  // Metadata tags for the UI to highlight strategic opportunities
  isGlobalBest?: boolean;
  isNicheOptimization?: boolean;
}

export interface Results {
  totalLowestBase: number;
  totalSelectedDiscounted: number;
  costSaving: number;
  combinations: Combination[];
  bestCombo: Combination | null;
  nicheCombos: Combination[]; // Explicitly separated out for UI visibility
  totalCombos: number;
  totalPossibleCombos: number;
  prices: number[][];
  discounts: number[][][];
  dopDifferences?: boolean[][];
}

const round2 = (x: number): number => Number(x.toFixed(2));

export const generateResults = (
  currentPrices: number[][],
  currentDiscounts: number[][][],
  cCount: number,
  tCount: number,
  avgDop = false
): Results => {
  const n = cCount;
  const m = tCount;

  const validPrices =
    Array.isArray(currentPrices) && currentPrices.length === m
      ? currentPrices.map((row) => [...row])
      : Array(m).fill(0).map(() => Array(n).fill(0));

  const validDiscounts =
    Array.isArray(currentDiscounts) && currentDiscounts.length === m
      ? currentDiscounts.map((row) => row.map((dopArr) => [...dopArr]))
      : Array(m).fill(0).map(() =>
          Array(n).fill(0).map(() => Array(n).fill(0))
        );

  if (avgDop) {
    for (let t = 0; t < m; t++) {
      const avgDiscounts = Array(n).fill(0);
      for (let dop = 0; dop < n; dop++) {
        const validDops = validDiscounts[t]
          .map((contractDops) => contractDops[dop])
          .filter((_, c) => validPrices[t][c] > 0);
        if (validDops.length > 0) {
          const avg = validDops.reduce((sum, d) => sum + d, 0) / validDops.length;
          avgDiscounts[dop] = Number(avg.toFixed(2));
        }
      }
      for (let c = 0; c < n; c++) {
        validDiscounts[t][c] = [...avgDiscounts];
      }
    }
  }

  // Determine baseline standalone minimum cost options
  const lowestBasePrices = Array(n)
    .fill(0)
    .map((_, j) => {
      const validRowPrices = validPrices.map((t) => t[j]).filter((p) => p > 0);
      return validRowPrices.length > 0
        ? Number(Math.min(...validRowPrices).toFixed(2))
        : 0;
    });

  const totalLowestBase = round2(
    lowestBasePrices.reduce((a, b) => a + b, 0)
  );
  const totalPossibleCombos = Math.pow(m, n);

  // Calculate how many total contracts each tenderer submitted bids for (to detect niche packages)
  const tendererTotalBidPoolCounts = Array(m)
    .fill(0)
    .map((_, t) => validPrices[t].filter((p) => p > 0).length);

  const validCosts: { dop: number; cost: number }[][][] = Array(m)
    .fill(0)
    .map(() => Array(n).fill(0).map(() => []));

  for (let t = 0; t < m; t++) {
    for (let c = 0; c < n; c++) {
      if (validPrices[t][c] === 0) continue;
      for (let dop = 0; dop < n; dop++) {
        const discountPercentage = validDiscounts[t][c][dop];
        const cost = round2(
          validPrices[t][c] * (1 - discountPercentage / 100)
        );
        validCosts[t][c].push({ dop, cost });
      }
    }
  }

  const validContractIndices = Array(n)
    .fill(0)
    .map((_, c) => c)
    .filter((c) => validCosts.some((t) => t[c].length > 0));

  const numValidContracts = validContractIndices.length;
  const allValidCombinations: Combination[] = [];

  if (numValidContracts === 0) {
    return {
      totalLowestBase,
      totalSelectedDiscounted: 0,
      costSaving: totalLowestBase,
      combinations: [],
      bestCombo: null,
      nicheCombos: [],
      totalCombos: 0,
      totalPossibleCombos,
      prices: validPrices,
      discounts: validDiscounts,
    };
  }

  // --- Admissible lower bounds (final-count DoP semantics) ---
  // Deepest discount tier a pair can ever reach in any combination.
  const maxRate = Array(m).fill(0).map(() => Array(n).fill(0));
  for (let t = 0; t < m; t++) {
    for (let c = 0; c < n; c++) {
      let mx = 0;
      for (let d = 0; d < n; d++) {
        if (validDiscounts[t][c][d] > mx) mx = validDiscounts[t][c][d];
      }
      maxRate[t][c] = mx;
    }
  }

  // Cheapest any completion of contract c can cost, over all tenderers.
  const bestFloor = Array(n).fill(0);
  for (let c = 0; c < n; c++) {
    let b: number | null = null;
    for (let t = 0; t < m; t++) {
      if (validPrices[t][c] <= 0) continue;
      const f = round2(validPrices[t][c] * (1 - maxRate[t][c] / 100));
      b = b === null ? f : Math.min(b, f);
    }
    bestFloor[c] = b ?? 0;
  }

  // suffix[k] = sum of floors over valid contracts k..numValidContracts-1.
  const suffix = Array(numValidContracts + 1).fill(0);
  for (let d = numValidContracts - 1; d >= 0; d--) {
    suffix[d] = round2(suffix[d + 1] + bestFloor[validContractIndices[d]]);
  }

  // Recursive search tree.
  function branchAndBound(
    current: number[] = [],
    tendererCounts: number[] = Array(m).fill(0),
    floorAcc = 0
  ) {
    // Admissible bound: every leaf below this node costs at least
    // floorAcc + suffix[current.length]. If that alone exceeds the raw-base
    // ceiling, no valid combination can live under it — safe to prune.
    if (round2(floorAcc + suffix[current.length]) > totalLowestBase) return;

    if (current.length === numValidContracts) {
      const fullAssignment = Array(n).fill(-1);
      const contractCosts = Array(n).fill(0);
      let passesIndividualCeilingRule = true;

      for (let i = 0; i < numValidContracts; i++) {
        const contractIdx = validContractIndices[i];
        const tenderer = current[i];

        fullAssignment[contractIdx] = tenderer;

        const validOptions = validCosts[tenderer][contractIdx];
        const dop = Math.max(0, tendererCounts[tenderer] - 1);

        const option =
          validOptions.find((o) => o.dop === dop) ||
          validOptions.find((o) => o.dop === 0);

        const finalCost =
          option ? option.cost : validPrices[tenderer][contractIdx];
        contractCosts[contractIdx] = finalCost;

        // Standalone ceiling verification
        if (finalCost > lowestBasePrices[contractIdx]) {
          passesIndividualCeilingRule = false;
          break;
        }
      }

      if (passesIndividualCeilingRule) {
        const total = round2(contractCosts.reduce((a, b) => a + b, 0));

        if (total <= totalLowestBase) {
          let isNicheOptimization = false;

          // STRATEGIC ANALYSIS RULE: Check if this combination contains a tenderer
          // who bid on a limited pool of contracts (<= 50% of overall pack) but won ALL of them.
          for (let t = 0; t < m; t++) {
            const totalBidsSubmittedByThem = tendererTotalBidPoolCounts[t];
            const totalContractsAwardedToThemInThisBranch = tendererCounts[t];

            if (
              totalBidsSubmittedByThem > 0 &&
              totalBidsSubmittedByThem <= Math.ceil(n / 2) &&
              totalContractsAwardedToThemInThisBranch === totalBidsSubmittedByThem
            ) {
              isNicheOptimization = true;
              break;
            }
          }

          allValidCombinations.push({
            assignment: fullAssignment,
            total,
            contractCosts,
            tendererCounts: [...tendererCounts],
            isNicheOptimization,
          });
        }
      }
      return;
    }

    const contractIdx = validContractIndices[current.length];
    for (let t = 0; t < m; t++) {
      if (validCosts[t][contractIdx].length === 0) continue;

      const nextCounts = [...tendererCounts];
      nextCounts[t]++;

      const floorCost = round2(
        validPrices[t][contractIdx] * (1 - maxRate[t][contractIdx] / 100)
      );

      branchAndBound(
        [...current, t],
        nextCounts,
        round2(floorAcc + floorCost)
      );
    }
  }

  branchAndBound();

  // Sort ascending by lowest overall cost
  allValidCombinations.sort((a, b) => a.total - b.total);

  // Tag the absolute top winner
  if (allValidCombinations.length > 0) {
    allValidCombinations[0].isGlobalBest = true;
  }

  const bestCombo = allValidCombinations[0] || null;
  const totalSelectedDiscounted = bestCombo ? bestCombo.total : totalLowestBase;
  const costSaving = Number(Math.max(0, totalLowestBase - totalSelectedDiscounted).toFixed(2));

  // Extract niche specialty combinations explicitly so they can be isolated in rendering
  const nicheCombos = allValidCombinations.filter((c) => c.isNicheOptimization);

  return {
    totalLowestBase,
    totalSelectedDiscounted,
    costSaving,
    combinations: allValidCombinations,
    bestCombo,
    nicheCombos,
    totalCombos: allValidCombinations.length,
    totalPossibleCombos: Math.pow(m, numValidContracts),
    prices: validPrices,
    discounts: validDiscounts,
  };
};
