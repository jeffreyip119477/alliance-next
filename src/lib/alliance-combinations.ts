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
// Small default scenarios enumerate the full combination set. Large scenarios
// switch to an exact best-award subset-DP path and retain only the winner.
// Opt-ins:
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
  /** Whether every selected contract has a valid award. */
  status: "ok" | "infeasible";
  /** Result-column indices that cannot be awarded. */
  infeasibleContracts: number[];
  /** True when only a scalable best result was retained instead of all leaves. */
  combinationsTruncated?: boolean;
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

/**
 * Exact best-award solver for large grids. It processes tenderers rather than
 * supplier assignments: each state is the set of contracts already awarded,
 * and a transition awards any feasible subset to the current tenderer. Since
 * the final win count is known for that subset, the correct final-count DoP
 * tier can be applied immediately. Complexity is O(m * 3^n), which is safe
 * for the supported n <= 10 / m <= 20 controls, unlike m^n enumeration.
 */
const solveBestBySubsetDp = (
  prices: number[][],
  discounts: number[][][],
  n: number,
  m: number,
  feasibleTenders: number[][],
  lowestBasePrices: number[],
  winCaps: number[]
): Combination | null => {
  const size = 1 << n;
  const fullMask = size - 1;
  const eligibleMasks = Array.from({ length: m }, (_, t) => {
    let mask = 0;
    for (let c = 0; c < n; c++) {
      if (feasibleTenders[c].includes(t)) mask |= 1 << c;
    }
    return mask;
  });

  const subsetCost = Array.from({ length: m }, (_, t) => {
    const costs = new Float64Array(size);
    costs.fill(Infinity);
    costs[0] = 0;
    for (let mask = 1; mask < size; mask++) {
      if ((mask & ~eligibleMasks[t]) !== 0) continue;
      const wins = mask.toString(2).split("1").length - 1;
      if (wins > winCaps[t]) continue;
      const tier = wins - 1;
      let total = 0;
      let valid = true;
      for (let c = 0; c < n; c++) {
        if ((mask & (1 << c)) === 0) continue;
        const price = prices[t]?.[c] ?? 0;
        const finalCost = round2(price * (1 - safeDiscount(discounts, t, c, tier) / 100));
        if (finalCost > lowestBasePrices[c]) {
          valid = false;
          break;
        }
        total = round2(total + finalCost);
      }
      if (valid) costs[mask] = total;
    }
    return costs;
  });

  let dp = new Float64Array(size);
  dp.fill(Infinity);
  dp[0] = 0;
  const parents: Int32Array[] = [];
  for (let t = 0; t < m; t++) {
    const next = new Float64Array(size);
    next.fill(Infinity);
    const parent = new Int32Array(size);
    parent.fill(-1);
    for (let mask = 0; mask < size; mask++) {
      if (!Number.isFinite(dp[mask])) continue;
      let sub = fullMask ^ mask;
      while (true) {
        const cost = subsetCost[t][sub];
        if (Number.isFinite(cost)) {
          const nextMask = mask | sub;
          const candidate = round2(dp[mask] + cost);
          if (candidate < next[nextMask]) {
            next[nextMask] = candidate;
            parent[nextMask] = mask;
          }
        }
        if (sub === 0) break;
        sub = (sub - 1) & (fullMask ^ mask);
      }
    }
    dp = next;
    parents.push(parent);
  }

  if (!Number.isFinite(dp[fullMask])) return null;

  const assignment = Array(n).fill(-1);
  const tendererCounts = Array(m).fill(0);
  let mask = fullMask;
  for (let t = m - 1; t >= 0; t--) {
    const previous = parents[t][mask];
    if (previous < 0) return null;
    const awarded = mask ^ previous;
    for (let c = 0; c < n; c++) {
      if ((awarded & (1 << c)) !== 0) {
        assignment[c] = t;
        tendererCounts[t]++;
      }
    }
    mask = previous;
  }

  const contractCosts = assignment.map((t, c) => {
    if (t < 0) return 0;
    const tier = Math.max(0, tendererCounts[t] - 1);
    return round2((prices[t]?.[c] ?? 0) * (1 - safeDiscount(discounts, t, c, tier) / 100));
  });
  return {
    assignment,
    contractCosts,
    total: round2(dp[fullMask]),
    tendererCounts,
  };
};

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
      ? Array.from({ length: m }, (_, t) =>
          Array.from({ length: n }, (_, c) => {
            const value = currentPrices[t]?.[c];
            return typeof value === "number" && Number.isFinite(value) && value > 0
              ? value
              : 0;
          })
        )
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

  // The validity ceiling is always the original lowest bid, independent of
  // award constraints. A pin/block may make a scenario infeasible, but it must
  // never silently authorize paying more than the lowest submitted base price.
  const lowestBasePrices = Array(n)
    .fill(0)
    .map((_, c) => {
      const submittedPrices = validPrices
        .map((row) => row[c])
        .filter((p) => p > 0);
      return submittedPrices.length > 0
        ? Number(Math.min(...submittedPrices).toFixed(2))
        : 0;
    });

  const totalLowestBase = round2(lowestBasePrices.reduce((a, b) => a + b, 0));

  const emptyResult = (infeasibleContracts: number[] = []): Results => ({
    totalLowestBase,
    totalSelectedDiscounted: 0,
    costSaving: 0,
    status: "infeasible",
    infeasibleContracts,
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
        return emptyResult([c]);
      }
    }
  }

  const validContractIndices = Array(n)
    .fill(0)
    .map((_, c) => c)
    .filter((c) => feasibleTenders[c].length > 0);

  const numValidContracts = validContractIndices.length;

  if (numValidContracts !== n) {
    return emptyResult(
      Array.from({ length: n }, (_, c) => c).filter((c) => feasibleTenders[c].length === 0)
    );
  }
  if (numValidContracts === 0) return emptyResult(Array.from({ length: n }, (_, c) => c));

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

  // Do not attempt to materialize an exponential result set. The exact
  // subset-DP path still returns the globally best compliant award and keeps
  // the 10-contract / 20-tenderer controls usable. Small grids retain the
  // complete explorer behavior for auditability.
  let estimatedLeafCount = 1;
  for (const c of validContractIndices) {
    estimatedLeafCount *= Math.max(1, feasibleTenders[c].length);
    if (estimatedLeafCount > 500_000) break;
  }
  if (estimatedLeafCount > 500_000) {
    const best = solveBestBySubsetDp(
      validPrices,
      validDiscounts,
      n,
      m,
      feasibleTenders,
      lowestBasePrices,
      winCaps
    );
    if (!best || best.total > totalLowestBase) {
      return emptyResult();
    }
    best.isNicheOptimization = Array.from({ length: m }, (_, t) =>
      validPrices[t].filter((p) => p > 0).length > 0 &&
      validPrices[t].filter((p) => p > 0).length <= Math.ceil(n / 2) &&
      best.tendererCounts[t] === validPrices[t].filter((p) => p > 0).length
    ).some(Boolean);
    best.isGlobalBest = true;
    const stats: SearchStats = {
      nodesVisited: 0,
      leavesEvaluated: 0,
      prunedNodes: 0,
      elapsedMs: round2(nowMs() - startedAt),
    };
    return {
      totalLowestBase,
      totalSelectedDiscounted: best.total,
      costSaving: round2(Math.max(0, totalLowestBase - best.total)),
      status: "ok",
      infeasibleContracts: [],
      combinationsTruncated: true,
      combinations: [best],
      bestCombo: best,
      nicheCombos: best.isNicheOptimization ? [best] : [],
      totalCombos: 1,
      prices: validPrices,
      discounts: validDiscounts,
      stats,
    };
  }

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

  if (allValidCombinations.length === 0) {
    const failed = emptyResult();
    failed.stats = stats;
    failed.stats.elapsedMs = round2(nowMs() - startedAt);
    return failed;
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
    status: "ok",
    infeasibleContracts: [],
    combinations: allValidCombinations,
    bestCombo,
    nicheCombos,
    totalCombos: allValidCombinations.length,
    prices: validPrices,
    discounts: validDiscounts,
    stats,
  };
};
