import { describe, it, expect } from "vitest";
import { generateResults } from "../domain/alliance-combinations";
import { projectToSelectedContracts } from "../domain/projection";

// ---------------------------------------------------------------------------
// Fixture: 5 contracts x 5 tenderers — the canonical A=3 / B=2 scenario.
//
// Base prices ($):
//   A: [160,160,160,200,200]      C: [500,...]        E: [500,...]
//   B: [250,250,250, 90, 90]     D: [100,100,100,500,500]
// DoP tiers (index = win count - 1):
//   A tier2 (3rd win) = 50% off  -> $80 per contract on C0-C2
//   B tier1 (2nd win) = 30% off  -> $63 per contract on C3-C4
//
// Expected best: A wins C0,C1,C2 ; B wins C3,C4
//   total = 3*80 + 2*63 = $366  (ceilings: 100/100/100/90/90, TLB=$480)
//
// Regression guard: the old sequential-cost pruning killed this combo when
// its running sum hit $490 > $480 before the leaf. The fixed engine must
// record it as Global Best with costSaving = 114.
// ---------------------------------------------------------------------------

const P5: number[][] = [
  /*A*/ [160, 160, 160, 200, 200],
  /*B*/ [250, 250, 250, 90, 90],
  /*C*/ [500, 500, 500, 500, 500],
  /*D*/ [100, 100, 100, 500, 500],
  /*E*/ [500, 500, 500, 500, 500],
];

const D5: number[][][] = [
  /*A*/ [[0, 0, 50, 0, 0]],
  /*B*/ [[0, 30, 0, 0, 0]],
  /*C*/ [[0, 0, 0, 0, 0]],
  /*D*/ [[0, 0, 0, 0, 0]],
  /*E*/ [[0, 0, 0, 0, 0]],
].map((row) => Array(5).fill(null).map(() => row[0]));

// Independent brute-force reference (no pruning): enumerates all m^n
// assignments and scores them with final-count DoP + both ceiling rules.
const bruteForceValidTotals = (
  P: number[][],
  D: number[][][],
  n: number,
  m: number
): { asg: number[]; total: number }[] => {
  const lbp = Array.from({ length: n }, (_, j) => {
    const rows = P.map((t) => t[j]).filter((p) => p > 0);
    return rows.length ? Math.min(...rows) : 0;
  });
  const TLB = Number(lbp.reduce((a, b) => a + b, 0).toFixed(2));
  const ref: { asg: number[]; total: number }[] = [];

  const walk = (cur: number[]) => {
    if (cur.length === n) {
      const counts = Array(m).fill(0);
      cur.forEach((t) => counts[t]++);
      let total = 0;
      for (let c = 0; c < n; c++) {
        const t = cur[c];
        if (P[t][c] === 0) return;
        const dop = Math.max(0, counts[t] - 1);
        const cost = Number(
          (P[t][c] * (1 - (D[t][c][dop] ?? 0) / 100)).toFixed(2)
        );
        if (cost > lbp[c]) return; // individual ceiling
        total += cost;
      }
      total = Number(total.toFixed(2));
      if (total <= TLB) ref.push({ asg: [...cur], total });
    } else {
      for (let t = 0; t < m; t++) walk([...cur, t]);
    }
  };
  walk([]);

  ref.sort((a, b) => a.total - b.total);
  return ref;
};

describe("alliance result engine — A=3 / B=2 scenario", () => {
  const res = generateResults(P5, D5, 5, 5);

  it("records the user-expected combo as Global Best at $366", () => {
    expect(res.bestCombo).not.toBeNull();
    // A,A,A,B,B on contracts C0..C4 (tenderer indices)
    const best = res.bestCombo!;
    expect(best.total).toBe(366);
    // assignment is indexed by contract: [A, A, A, B, B]
    expect(best.assignment.filter((a) => a >= 0)).toEqual([0, 0, 0, 1, 1]);
    // per-contract costs: A at tier2 (50% off 160 = 80), B at tier1 (30% off 90 = 63)
    expect(best.contractCosts).toEqual([80, 80, 80, 63, 63]);
    // tenderer win counts: A=3, B=2
    expect(best.tendererCounts[0]).toBe(3);
    expect(best.tendererCounts[1]).toBe(2);
  });

  it("reports the true saving ($114), not the old under-count ($54)", () => {
    expect(res.totalLowestBase).toBe(480);
    expect(res.costSaving).toBe(114);
  });

  it("keeps exactly the two leaf-valid combinations", () => {
    // Brute-force ground truth: only A,A,A,B,B ($366) and D,D,D,B,B ($426) pass.
    expect(res.totalCombos).toBe(2);
    const totals = res.combinations.map((c) => c.total);
    expect(totals).toContain(366);
    expect(totals).toContain(426);
  });

  it("honours the individual ceiling rule (no contract above its lowest base)", () => {
    const lbp = [100, 100, 100, 90, 90];
    for (const combo of res.combinations) {
      for (let c = 0; c < 5; c++) {
        expect(combo.contractCosts[c]).toBeLessThanOrEqual(lbp[c]);
      }
      expect(combo.total).toBeLessThanOrEqual(res.totalLowestBase);
    }
  });

  it("matches a naive full m^n brute-force reference on this dataset", () => {
    // Independent re-implementation: enumerate all 5^5 combos, score with
    // final-count DoP + both ceiling rules. Must agree exactly.
    const ref = bruteForceValidTotals(P5, D5, 5, 5);
    expect(ref.length).toBe(res.totalCombos);
    ref.forEach((r, i) => {
      expect(r.total).toBe(res.combinations[i].total);
      // compare per-contract assignment (compact form -> full index array)
      const full = res.combinations[i].assignment;
      r.asg.forEach((t, c) => expect(full[c]).toBe(t));
    });
  });

  it("handles the no-bid / zero-price edge without crashing", () => {
    // All-zero grid: engine must return an empty-but-well-formed result.
    const zeros = generateResults(P5.map((r) => r.map(() => 0)), D5, 5, 5);
    expect(zeros.bestCombo).toBeNull();
    expect(zeros.totalCombos).toBe(0);

    // Partial bids: only A and B bid on C0/C1 — the selected full scenario is
    // infeasible because C2..C4 cannot be awarded.
    const sparseP = P5.map((r) => r.map((v, c) => (c < 2 ? v : 0)));
    const sparseD = D5.map((t) => t.map(() => [0, 0, 0, 0, 0]));
    const sres = generateResults(sparseP, sparseD, 5, 5);
    expect(sres.bestCombo).toBeNull();
    expect(sres.status).toBe("infeasible");
    // C2..C4 have no bid and therefore cannot be silently omitted.
    expect(sres.infeasibleContracts).toEqual([2, 3, 4]);
    expect(sres.costSaving).toBe(0);
  });

  it("reports search stats and never reports negative savings", () => {
    expect(res.stats.nodesVisited).toBeGreaterThan(0);
    expect(res.stats.leavesEvaluated).toBeGreaterThan(0);
    expect(res.stats.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(res.costSaving).toBeGreaterThanOrEqual(0);
  });
});

describe("scale sanity: no valid combo is ever pruned away", () => {
  it("pruned search finds every leaf-valid combo on random data (n=5, m=5)", () => {
    // Property check against brute force on a few random grids: the admissible
    // bound must never drop a valid combination.
    const n = 5;
    for (let trial = 0; trial < 25; trial++) {
      const P: number[][] = [];
      const D: number[][][] = [];
      for (let t = 0; t < 5; t++) {
        const row: number[] = [];
        const drow: number[][] = [];
        for (let c = 0; c < n; c++) {
          // ~20% of cells are no-bid (price 0) to exercise sparse paths
          if (Math.random() < 0.2) row.push(0);
          else row.push(Math.floor(Math.random() * 1000) + 100);
          drow.push(Array(n).fill(0));
        }
        for (let c = 0; c < n; c++) {
          // random deep tiers so final-count discounting actually bites on every contract
          for (let k = 1; k < n; k++) drow[c][k] = Number((Math.random() * 60).toFixed(2));
        }
        P.push(row);
        D.push(drow);
      }

      const res = generateResults(P, D, n, 5);
      const ref = bruteForceValidTotals(P, D, n, 5);

      expect(res.totalCombos).toBe(ref.length);
    }
  });
});

describe("fastMode: incumbent-bound fast path", () => {
  it("returns only the optimal tie(s) on the A=3/B=2 fixture", () => {
    const slow = generateResults(P5, D5, 5, 5);
    const fast = generateResults(P5, D5, 5, 5, false, { fastMode: true });
    expect(slow.totalCombos).toBe(2);
    expect(fast.totalCombos).toBe(1);
    expect(fast.bestCombo?.total).toBe(366);
    expect(fast.costSaving).toBe(114);
    expect(fast.totalLowestBase).toBe(480);
    // same top winner as slow mode
    expect(fast.bestCombo?.assignment).toEqual(slow.bestCombo?.assignment);
  });

  it("fastMode best total always matches slow mode on random grids", () => {
    const n = 5;
    for (let trial = 0; trial < 15; trial++) {
      const P: number[][] = [];
      const D: number[][][] = [];
      for (let t = 0; t < 5; t++) {
        const row: number[] = [];
        const drow: number[][] = [];
        for (let c = 0; c < n; c++) {
          if (Math.random() < 0.2) row.push(0);
          else row.push(Math.floor(Math.random() * 1000) + 100);
          drow.push(Array(n).fill(0));
        }
        for (let c = 0; c < n; c++) {
          for (let k = 1; k < n; k++) drow[c][k] = Number((Math.random() * 60).toFixed(2));
        }
        P.push(row);
        D.push(drow);
      }
      const slow = generateResults(P, D, n, 5);
      const fast = generateResults(P, D, n, 5, false, { fastMode: true });
      if (slow.bestCombo === null) {
        expect(fast.bestCombo).toBeNull();
      } else {
        expect(fast.bestCombo).not.toBeNull();
        expect(fast.bestCombo!.total).toBe(slow.bestCombo!.total);
        // every fast combo must be an optimal tie in slow mode
        for (const c of fast.combinations) {
          expect(c.total).toBe(slow.bestCombo!.total);
        }
      }
    }
  });
});

describe("constraints: forced / forbidden / maxWins", () => {
  it("keeps the original lowest-base ceiling when the cheapest bid is blocked", () => {
    const prices = [
      [500, 500],
      [300, 400],
      [400, 100],
    ];
    const discounts = prices.map((row) =>
      row.map(() => [0, 0])
    );
    const forbidden = Array.from({ length: 3 }, (_, t) =>
      Array.from({ length: 2 }, (_, c) => t === 1 && c === 0)
    );

    const res = generateResults(prices, discounts, 2, 3, false, { forbidden });

    expect(res.totalLowestBase).toBe(400);
    expect(res.status).toBe("infeasible");
    expect(res.bestCombo).toBeNull();
    expect(res.costSaving).toBe(0);
  });

  it("forces a specific tenderer to win a contract", () => {
    // Force contract 3 to B (index 1): the A,A,A,B,B optimum already has B there.
    const res = generateResults(P5, D5, 5, 5, false, {
      forced: [null, null, null, 1, null],
    });
    expect(res.bestCombo?.total).toBe(366);
    for (const c of res.combinations) expect(c.assignment[3]).toBe(1);
  });

  it("forbidding a cell removes every combo that used it", () => {
    // Forbid D from C0: the D,D,D,B,B award is no longer valid under the
    // original global lowest-base ceiling; only the A,A,A,B,B award remains.
    const forbidden = Array.from({ length: 5 }, (_, t) =>
      Array.from({ length: 5 }, (_, c) => t === 3 && c === 0)
    );
    const res = generateResults(P5, D5, 5, 5, false, { forbidden });
    expect(res.totalCombos).toBe(1);
    expect(res.combinations.every((c) => c.assignment[0] !== 3)).toBe(true);
    expect(res.bestCombo?.total).toBe(366);
  });

  it("maxWins caps how many contracts a tenderer can win", () => {
    // Cap A at 2 wins: A,A,A,B,B dies; D,D,D,B,B survives at 426.
    const res = generateResults(P5, D5, 5, 5, false, {
      maxWins: [2, 5, 5, 5, 5],
    });
    expect(res.bestCombo?.total).toBe(426);
    for (const c of res.combinations)
      expect(c.tendererCounts[0]).toBeLessThanOrEqual(2);
  });

  it("a forced tenderer that cannot bid makes the scenario infeasible (no crash)", () => {
    // E's row zeroed, then E forced onto C0 -> C0 has no feasible tenderer.
    const P = P5.map((row, t) => (t === 4 ? row.map(() => 0) : row));
    const res = generateResults(P, D5, 5, 5, false, {
      forced: [4, null, null, null, null],
    });
    expect(res.totalCombos).toBe(0);
    expect(res.bestCombo).toBeNull();
  });
});

describe("projection: selected-contract scenarios", () => {
  it("reindexes ladders to the selected count and matches brute force", () => {
    // Niche fixture: 6 contracts x 3 tenderers, select contracts 1,2,4,5 (k=4).
    // T0 bids only on C1,C2 at $10 with tier1 (2nd win) = 90% off.
    // T1 bids $100 everywhere (no discounts); T2 bids $200 everywhere.
    const n = 6;
    const m = 3;
    const P: number[][] = [
      /*T0*/ [0, 10, 10, 0, 0, 0],
      /*T1*/ [100, 100, 100, 100, 100, 100],
      /*T2*/ [200, 200, 200, 200, 200, 200],
    ];
    const D: number[][][] = [
      /*T0*/ [
        [0, 0, 0, 0, 0, 0],
        [0, 90, 0, 0, 0, 0],
        [0, 90, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
      /*T1*/ Array(n).fill(null).map(() => Array(n).fill(0)),
      /*T2*/ Array(n).fill(null).map(() => Array(n).fill(0)),
    ];

    const selected = [1, 2, 4, 5];
    const proj = projectToSelectedContracts(P, D, selected);
    expect(proj.cCount).toBe(4);
    expect(proj.indexMap).toEqual(selected);
    expect(proj.prices).toHaveLength(m);
    // T0 bids only on C1,C2 (both selected); C4,C5 are no-bid (0).
    expect(proj.prices[0]).toEqual([10, 10, 0, 0]);
    // ladders reindexed to length k=4 (wins capped at 4)
    for (const row of proj.discounts) {
      for (const ladder of row) expect(ladder).toHaveLength(4);
    }

    const res = generateResults(proj.prices, proj.discounts, proj.cCount, m);

    // Brute force over the projected grid (k=4 tiers reachable).
    const ref = bruteForceValidTotals(proj.prices, proj.discounts, proj.cCount, m);
    expect(res.totalCombos).toBe(ref.length);
    expect(res.totalLowestBase).toBe(220); // 10 + 10 + 100 + 100
    // Only valid combo: T0 wins C1,C2 (2+2=2 at tier1 90% off) + T1 wins C4,C5 (200).
    expect(res.bestCombo?.total).toBe(202);
    // Niche: T0 bid on 2 of 4 selected contracts (ceil(4/2)=2) and won all of them.
    expect(res.bestCombo?.isNicheOptimization).toBe(true);
    expect(res.nicheCombos.length).toBe(1);
  });

  it("projects forced/forbidden constraints onto the selected subset", () => {
    const P: number[][] = [
      [10, 20, 30],
      [15, 25, 35],
    ];
    const D: number[][][] = [
      Array.from({ length: 3 }, () => [0, 0, 0]),
      Array.from({ length: 3 }, () => [0, 0, 0]),
    ];
    const forced = [1, null, null];
    const forbidden = [
      [false, true, false],
      [false, false, false],
    ];
    const proj = projectToSelectedContracts(P, D, [0, 2], forced, forbidden);
    expect(proj.forced).toEqual([1, null]);
    expect(proj.forbidden).toEqual([
      [false, false],
      [false, false],
    ]);
  });
});

describe("NaN safety", () => {
  it("short ladders (fewer tiers than contracts) produce finite results", () => {
    // A's ladder has only 2 tiers on a 5-contract grid.
    const Dshort: number[][][] = [
      /*A*/ [[0, 50]],
      /*B*/ [[0, 30, 0, 0, 0]],
      /*C*/ [[0, 0, 0, 0, 0]],
      /*D*/ [[0, 0, 0, 0, 0]],
      /*E*/ [[0, 0, 0, 0, 0]],
    ].map((row) => Array(5).fill(null).map(() => row[0]));

    for (const avgDop of [false, true]) {
      const res = generateResults(P5, Dshort, 5, 5, avgDop);
      expect(res.bestCombo).not.toBeNull();
      // Parity against brute force on the engine's (possibly averaged) ladders:
      // A's missing tier2 reads as 0%, never NaN.
      const ref = bruteForceValidTotals(res.prices, res.discounts, 5, 5);
      expect(res.totalCombos).toBe(ref.length);
      if (ref.length > 0) expect(res.bestCombo!.total).toBe(ref[0].total);
      for (const combo of res.combinations) {
        expect(Number.isFinite(combo.total)).toBe(true);
        for (const cost of combo.contractCosts) {
          expect(Number.isFinite(cost)).toBe(true);
        }
      }
    }
  });

  it("avgDop with an empty bid row does not produce NaN", () => {
    // T2 (E) bids nothing; avgDop must not divide by zero.
    const P = P5.map((row, t) => (t === 4 ? row.map(() => 0) : row));
    const res = generateResults(P, D5, 5, 5, true);
    expect(Number.isFinite(res.totalLowestBase)).toBe(true);
    expect(Number.isFinite(res.costSaving)).toBe(true);
    for (const combo of res.combinations) {
      expect(Number.isFinite(combo.total)).toBe(true);
    }
  });
});

describe("scalable large-grid path", () => {
  it("keeps 10 contracts and 20 tenderers exact without enumerating 20^10 leaves", () => {
    const n = 10;
    const m = 20;
    const prices = Array.from({ length: m }, () => Array(n).fill(100));
    const discounts = Array.from({ length: m }, () =>
      Array.from({ length: n }, () => Array(n).fill(0))
    );
    const result = generateResults(prices, discounts, n, m);
    expect(result.status).toBe("ok");
    expect(result.bestCombo?.total).toBe(1000);
    expect(result.combinationsTruncated).toBe(true);
    expect(result.combinations).toHaveLength(1);
  });
});
