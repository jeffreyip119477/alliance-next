// Pure result-calculation engine for the alliance combinations tool.
// Extracted from useAllianceCombinations.ts so it can be unit-tested directly.
//
// DoP semantics (FINAL-COUNT): if a tenderer wins k contracts in a combination,
// every one of those k contracts is priced at discount tier index k-1.
//
// Pruning uses an ADMISSIBLE lower bound (per-contract floor = cheapest
// possible cost after the deepest reachable discount tier). Because the bound
// is a true lower bound on every leaf under a node, no valid combination can
// be pruned away — contract/tenderer ordering affects performance only, never
// the enumerated set.
//
// Default mode (no options) enumerates exactly the same combination set as the
// original engine, so existing tests pass unchanged. Opt-ins:
//   - fastMode: incumbent-based bound; returns only optimal-tie combinations.
//   - forced / forbidden / maxWins: hard scenario constraints.
//   - avgDop (5th arg): averages each tenderer's ladders across their bids.
//
// Niche rule: a combination is "niche" when some tenderer wins every contract
// they bid on, and they bid on <= ceil(n/2) contracts, where n is the
// contract count passed in (cCount — the selected count under projection).

export interface Combination {
  assignment: number[];
  contractCosts: number[];
  total: number;
  tendererCounts: number[];
  // Metadata tags for the UI to highlight strategic opportunities
  isGlobalBest?: boolean;
  isNicheOptimization?: boolean;
}

export interface EngineOptions {
  /**
   * Opt-in incumbent bound: the first valid leaf found sets a running best
   * and the search prunes everything that cannot beat (or tie) it. The
   * result set becomes "all optimal ties" — a subset of default mode.
   * bestCombo, totalSelectedDiscounted and costSaving are unchanged.
   */
  fastMode?: boolean;
  /** forced[c] = tenderer t must win contract c (null/absent = free). A forced
   *  tenderer that cannot bid the contract makes the scenario infeasible. */
  forced?: (number | null)[];
  /** forbidden[t][c] = tenderer t may not win contract c. */
  forbidden?: boolean[][];
  /** maxWins[t] = hard cap on the number of contracts tenderer t may win (default: all). */
  maxWins?: number[];
}

export interface SearchStats {
  nodesVisited: number;
  leavesEvaluated: number;
  prunedNodes: number;
  elapsedMs: number;
}

export interface Results {
  totalLowestBase: number;
  totalSelectedDiscounted: number;
  costSaving: number;
  combinations: Combination[];
  bestCombo: Combination | null;
  nicheCombos: Combination[]; // Explicitly separated out for UI visibility
  totalCombos: number;
  prices: number[][];
  discounts: number[][][];
  stats: SearchStats;
}

const round2 = (x: number): number => Number(x.toFixed(2));

/** NaN-safe tier access: missing/short ladder entries read as 0%. */
const safeDiscount = (
  ladders: number[][][],
  t: number,
  c: number,
  d: number
): number => {
  const v = ladders[t]?.[c]?.[d];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};

const nowMs = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export const generateResults = (
  currentPrices: number[][],
  currentDiscounts: number[][][],
  cCount: number,
  tCount: number,
  avgDop = false,
  options: EngineOptions = {}
): Results => {
  const n = cCount;
  const m = tCount;
  const startedAt = nowMs();

  const fastMode = options.fastMode === true;
  const forced = options.forced ?? null;
  const forbidden = options.forbidden ?? null;
  const maxWins = options.maxWins ?? null;

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

  // Average-DoP mode: replace each tenderer's per-contract ladders with the
  // average of their ladders across the contracts they bid on (NaN-safe).
  if (avgDop) {
    for (let t = 0; t < m; t++) {
      const avgDiscounts = Array(n).fill(0);
      for (let dop = 0; dop < n; dop++) {
        let sum = 0;
        let count = 0;
        for (let c = 0; c < n; c++) {
          if (validPrices[t][c] > 0) {
            sum += safeDiscount(validDiscounts, t, c, dop);
            count++;
          }
        }
        if (count > 0) avgDiscounts[dop] = Number((sum / count).toFixed(2));
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

  // Calculate how many total contracts each tenderer submitted bids for
  // (to detect niche packages).
  const tendererTotalBidPoolCounts = Array(m)
    .fill(0)
    .map((_, t) => validPrices[t].filter((p) => p > 0).length);

  // Hard win caps per tenderer. A cap of 0 (or a missing entry) means "no
  // cap" — the tenderer may win up to all n contracts. Only a positive cap
  // restricts the search (e.g. maxWins[t] = 2 caps tenderer t at two wins).
  const winCaps = Array(m).fill(n).map((_, t) => {
    const cap = maxWins?.[t];
    return typeof cap === "number" && Number.isFinite(cap) && cap > 0
      ? Math.min(n, Math.floor(cap))
      : n;
  });

  // Tenderers that may win contract c (bid present, not forbidden, forced ok).
  const feasibleTenders: number[][] = Array(n)
    .fill(0)
    .map((_, c) => {
      const list: number[] = [];
      for (let t = 0; t < m; t++) {
        if (validPrices[t][c] <= 0) continue;
        if (forbidden && forbidden[t]?.[c] === true) continue;
        if (forced && forced[c] != null && forced[c] !== t) continue;
        list.push(t);
      }
      return list;
    });

  const emptyResult = (): Results => ({
    totalLowestBase,
    totalSelectedDiscounted: 0,
    costSaving: totalLowestBase,
    combinations: [],
    bestCombo: null,
    nicheCombos: [],
    totalCombos: 0,
    prices: validPrices,
    discounts: validDiscounts,
    stats: {
      nodesVisited: 0,
      leavesEvaluated: 0,
      prunedNodes: 0,
      elapsedMs: round2(nowMs() - startedAt),
    },
  });

  // A forced contract whose forced tenderer cannot bid is infeasible.
  if (forced) {
    for (let c = 0; c < n; c++) {
      if (forced[c] != null && feasibleTenders[c].length === 0) {
        return emptyResult();
      }
    }
  }

  const validContractIndices = Array(n)
    .fill(0)
    .map((_, c) => c)
    .filter((c) => feasibleTenders[c].length > 0);

  const numValidContracts = validContractIndices.length;

  if (numValidContracts === 0) return emptyResult();

  // --- Admissible lower bounds (final-count DoP semantics) ---
  // Deepest discount tier a pair can ever reach (respecting the win cap).
  const maxRate = Array(m).fill(0).map(() => Array(n).fill(0));
  for (let t = 0; t < m; t++) {
    for (let c = 0; c < n; c++) {
      let mx = 0;
      for (let d = 0; d < winCaps[t]; d++) {
        const v = safeDiscount(validDiscounts, t, c, d);
        if (v > mx) mx = v;
      }
      maxRate[t][c] = mx;
    }
  }

  const floorCost = (t: number, c: number): number =>
    round2(validPrices[t][c] * (1 - maxRate[t][c] / 100));

  // Cheapest any completion of contract c can cost, over all feasible tenderers.
  const bestFloor = Array(n).fill(0);
  for (let c = 0; c < n; c++) {
    let b: number | null = null;
    for (const t of feasibleTenders[c]) {
      const f = floorCost(t, c);
      b = b === null ? f : Math.min(b, f);
    }
    bestFloor[c] = b ?? 0;
  }

  // Contract order: fewest feasible tenderers first (fail fast), then cheapest
  // standalone base, then original index. Ordering never changes the result set.
  const orderedContracts = [...validContractIndices].sort(
    (a, b) =>
      feasibleTenders[a].length - feasibleTenders[b].length ||
      lowestBasePrices[a] - lowestBasePrices[b] ||
      a - b
  );

  // suffix[k] = sum of floors over ordered contracts k..numValidContracts-1.
  const suffix = Array(numValidContracts + 1).fill(0);
  for (let d = numValidContracts - 1; d >= 0; d--) {
    suffix[d] = round2(suffix[d + 1] + bestFloor[orderedContracts[d]]);
  }

  // Tenderer order per contract: cheapest floor first (finds good incumbents
  // early in fastMode), then index.
  const orderedTenders: number[][] = orderedContracts.map((c) =>
    [...feasibleTenders[c]].sort((a, b) => floorCost(a, c) - floorCost(b, c) || a - b)
  );

  let allValidCombinations: Combination[] = [];
  const stats: SearchStats = {
    nodesVisited: 0,
    leavesEvaluated: 0,
    prunedNodes: 0,
    elapsedMs: 0,
  };
  let incumbent = fastMode ? totalLowestBase : Infinity;

  // Mutable backtracking state (no per-branch array copies).
  const path: number[] = new Array(numValidContracts);
  const counts = Array(m).fill(0);
  const contractCosts = Array(n).fill(0);
  const fullAssignment = Array(n).fill(-1);

  function search(p: number, floorAcc: number) {
    stats.nodesVisited++;

    // Admissible bound: every leaf under this node costs at least
    // floorAcc + suffix[p]. If that alone exceeds the bound (TLB in default
    // mode, the incumbent in fastMode), no valid combination can live here.
    if (round2(floorAcc + suffix[p]) > (fastMode ? incumbent : totalLowestBase)) {
      stats.prunedNodes++;
      return;
    }

    if (p === numValidContracts) {
      stats.leavesEvaluated++;

      let passesIndividualCeilingRule = true;
      let total = 0;

      for (let i = 0; i < numValidContracts; i++) {
        const contractIdx = orderedContracts[i];
        const tenderer = path[i];

        fullAssignment[contractIdx] = tenderer;

        // Final-count DoP: this contract is priced at tier (wins - 1).
        const dop = Math.max(0, counts[tenderer] - 1);
        const finalCost = round2(
          validPrices[tenderer][contractIdx] *
            (1 - safeDiscount(validDiscounts, tenderer, contractIdx, dop) / 100)
        );
        contractCosts[contractIdx] = finalCost;

        // Standalone ceiling verification
        if (finalCost > lowestBasePrices[contractIdx]) {
          passesIndividualCeilingRule = false;
          break;
        }
        total += finalCost;
      }

      if (passesIndividualCeilingRule) {
        const total2 = round2(total);
        if (fastMode ? total2 <= incumbent : total2 <= totalLowestBase) {
          if (fastMode) incumbent = Math.min(incumbent, total2);

          // STRATEGIC ANALYSIS RULE: a tenderer who bid on a limited pool
          // (<= 50% of the contract count) but won ALL of them.
          let isNicheOptimization = false;
          for (let t = 0; t < m; t++) {
            const totalBidsSubmittedByThem = tendererTotalBidPoolCounts[t];
            if (
              totalBidsSubmittedByThem > 0 &&
              totalBidsSubmittedByThem <= Math.ceil(n / 2) &&
              counts[t] === totalBidsSubmittedByThem
            ) {
              isNicheOptimization = true;
              break;
            }
          }

          allValidCombinations.push({
            assignment: [...fullAssignment],
            total: total2,
            contractCosts: [...contractCosts],
            tendererCounts: [...counts],
            isNicheOptimization,
          });
        }
      }
      return;
    }

    const contractIdx = orderedContracts[p];
    for (const t of orderedTenders[p]) {
      if (counts[t] >= winCaps[t]) continue;
      path[p] = t;
      counts[t]++;
      search(p + 1, round2(floorAcc + floorCost(t, contractIdx)));
      counts[t]--;
    }
  }

  search(0, 0);

  // fastMode contract: the enumerated set is exactly the optimal ties —
  // leaves found while the incumbent was still high must be dropped.
  if (fastMode) {
    allValidCombinations = allValidCombinations.filter(
      (c) => c.total === incumbent
    );
  }

  // Sort ascending by lowest overall cost
  allValidCombinations.sort((a, b) => a.total - b.total);

  // Tag the absolute top winner
  if (allValidCombinations.length > 0) {
    allValidCombinations[0].isGlobalBest = true;
  }

  const bestCombo = allValidCombinations[0] || null;
  const totalSelectedDiscounted = bestCombo ? bestCombo.total : totalLowestBase;
  const costSaving = Number(
    Math.max(0, totalLowestBase - totalSelectedDiscounted).toFixed(2)
  );

  // Extract niche specialty combinations explicitly so they can be isolated in rendering
  const nicheCombos = allValidCombinations.filter((c) => c.isNicheOptimization);

  stats.elapsedMs = round2(nowMs() - startedAt);

  return {
    totalLowestBase,
    totalSelectedDiscounted,
    costSaving,
    combinations: allValidCombinations,
    bestCombo,
    nicheCombos,
    totalCombos: allValidCombinations.length,
    prices: validPrices,
    discounts: validDiscounts,
    stats,
  };
};
