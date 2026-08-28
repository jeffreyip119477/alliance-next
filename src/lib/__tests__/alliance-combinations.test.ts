import { describe, it, expect } from "vitest";
import { generateResults } from "../alliance-combinations";

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
    const n = 5;
    const lbp = P5[0].map((_, j) => Math.min(...P5.map((t) => t[j])));
    const TLB = lbp.reduce((a, b) => a + b, 0);
    const ref: { asg: number[]; total: number }[] = [];

    const walk = (cur: number[]) => {
      if (cur.length === n) {
        const counts = Array(5).fill(0);
        cur.forEach((t) => counts[t]++);
        let total = 0;
        for (let c = 0; c < n; c++) {
          const t = cur[c];
          const dop = Math.max(0, counts[t] - 1);
          const cost = Number((P5[t][c] * (1 - D5[t][c][dop] / 100)).toFixed(2));
          if (cost > lbp[c]) return; // individual ceiling
          total += cost;
        }
        total = Number(total.toFixed(2));
        if (total <= TLB) ref.push({ asg: [...cur], total });
      } else {
        for (let t = 0; t < 5; t++) walk([...cur, t]);
      }
    };
    walk([]);

    ref.sort((a, b) => a.total - b.total);
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

    // Partial bids: only A and B bid on C0/C1 — still computable.
    const sparseP = P5.map((r) => r.map((v, c) => (c < 2 ? v : 0)));
    const sparseD = D5.map((t) => t.map(() => [0, 0, 0, 0, 0]));
    const sres = generateResults(sparseP, sparseD, 5, 5);
    expect(sres.bestCombo).not.toBeNull();
    // C0..C4 all zero except A/B bids on first two -> valid contracts are only C0,C1.
    // Best: D not bidding; A vs B on both: A tier2? A has no tier data here (all 0)
    // so plain base prices apply: A,A = 320, B,B=500, mixed... expect total <= TLB(=190)?
    // C0 lbp=min(160,250,...)=100? No — D bids 100 on C0 (kept), so lbp=[100,100], TLB=200.
    expect(sres.totalLowestBase).toBe(200);
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

      // Independent brute force (no pruning at all)
      const lbp = Array.from({ length: n }, (_, j) => {
        const rows = P.map((t) => t[j]).filter((p) => p > 0);
        return rows.length ? Math.min(...rows) : 0;
      });
      const TLB = Number(lbp.reduce((a, b) => a + b, 0).toFixed(2));
      let refCount = 0;
      const walk = (cur: number[]) => {
        if (cur.length === n) {
          const counts = Array(5).fill(0);
          cur.forEach((t) => counts[t]++);
          let total = 0;
          for (let c = 0; c < n; c++) {
            const t = cur[c];
            if (P[t][c] === 0) return;
            const dop = Math.max(0, counts[t] - 1);
            const cost = Number((P[t][c] * (1 - D[t][c][dop] / 100)).toFixed(2));
            if (cost > lbp[c]) return;
            total += cost;
          }
          total = Number(total.toFixed(2));
          if (total <= TLB) refCount++;
        } else {
          for (let t = 0; t < 5; t++) walk([...cur, t]);
        }
      };
      walk([]);

      expect(res.totalCombos).toBe(refCount);
    }
  });
});
