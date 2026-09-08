// Local verification harness for the alliance engine.
//
// The DSH sandbox blocks the vitest/esbuild child-process toolchain
// (spawn EPERM on piped stdio), so this script mirrors the vitest suite
// invariants in plain Node (Node 25 runs .ts directly via type stripping).
// Run: node scripts/check-engine.ts
//
// Exits non-zero if any check fails.

import { generateResults } from "../src/lib/alliance-combinations.ts";
import { projectToSelectedContracts } from "../src/lib/projection.ts";

let failures = 0;
let passes = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) {
    passes++;
    console.log(`  PASS ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

// ---------------------------------------------------------------------------
// Fixture: canonical A=3 / B=2 scenario (5 contracts x 5 tenderers).
// ---------------------------------------------------------------------------
const P5: number[][] = [
  [160, 160, 160, 200, 200],
  [250, 250, 250, 90, 90],
  [500, 500, 500, 500, 500],
  [100, 100, 100, 500, 500],
  [500, 500, 500, 500, 500],
];
const D5: number[][][] = [
  [[0, 0, 50, 0, 0]],
  [[0, 30, 0, 0, 0]],
  [[0, 0, 0, 0, 0]],
  [[0, 0, 0, 0, 0]],
  [[0, 0, 0, 0, 0]],
].map((row) => Array(5).fill(null).map(() => row[0]));

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
        const cost = Number((P[t][c] * (1 - (D[t][c][dop] ?? 0) / 100)).toFixed(2));
        if (cost > lbp[c]) return;
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

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// --- canonical scenario ---
console.log("canonical A=3/B=2 scenario");
const res = generateResults(P5, D5, 5, 5);
check("bestCombo total = 366", res.bestCombo?.total === 366, `got ${res.bestCombo?.total}`);
check("best assignment [A,A,A,B,B]", eq(res.bestCombo?.assignment.filter((a) => a >= 0), [0, 0, 0, 1, 1]));
check("best contractCosts [80,80,80,63,63]", eq(res.bestCombo?.contractCosts, [80, 80, 80, 63, 63]));
check("win counts A=3, B=2", res.bestCombo?.tendererCounts[0] === 3 && res.bestCombo?.tendererCounts[1] === 2);
check("totalLowestBase = 480", res.totalLowestBase === 480);
check("costSaving = 114", res.costSaving === 114);
check("exactly 2 valid combos", res.totalCombos === 2, `got ${res.totalCombos}`);
check("totals include 366 and 426", res.combinations.some((c) => c.total === 366) && res.combinations.some((c) => c.total === 426));
{
  const lbp = [100, 100, 100, 90, 90];
  let ok = true;
  for (const combo of res.combinations) {
    for (let c = 0; c < 5; c++) if (combo.contractCosts[c] > lbp[c]) ok = false;
    if (combo.total > res.totalLowestBase) ok = false;
  }
  check("per-contract ceilings hold", ok);
}
{
  const ref = bruteForceValidTotals(P5, D5, 5, 5);
  let ok = ref.length === res.totalCombos;
  ref.forEach((r, i) => {
    if (r.total !== res.combinations[i].total) ok = false;
    r.asg.forEach((t, c) => {
      if (res.combinations[i].assignment[c] !== t) ok = false;
    });
  });
  check("matches m^n brute-force reference exactly", ok);
}
check("stats present and sane", res.stats.nodesVisited > 0 && res.stats.leavesEvaluated > 0 && res.stats.elapsedMs >= 0);

// --- edge: zeros and sparse ---
console.log("edge cases");
{
  const zeros = generateResults(P5.map((r) => r.map(() => 0)), D5, 5, 5);
  check("all-zero grid -> empty result", zeros.bestCombo === null && zeros.totalCombos === 0);
  const sparseP = P5.map((r) => r.map((v, c) => (c < 2 ? v : 0)));
  const sparseD = D5.map((t) => t.map(() => [0, 0, 0, 0, 0]));
  const sres = generateResults(sparseP, sparseD, 5, 5);
  check("sparse grid -> bestCombo present, TLB=200", sres.bestCombo !== null && sres.totalLowestBase === 200, `TLB=${sres.totalLowestBase}`);
}

// --- random parity vs brute force ---
console.log("random parity vs brute force (25 trials)");
{
  let ok = true;
  let detail = "";
  const n = 5;
  for (let trial = 0; trial < 25; trial++) {
    const P: number[][] = [];
    const D: number[][][] = [];
    for (let t = 0; t < 5; t++) {
      const row: number[] = [];
      const drow: number[][] = [];
      for (let c = 0; c < n; c++) {
        row.push(Math.random() < 0.2 ? 0 : Math.floor(Math.random() * 1000) + 100);
        drow.push(Array(n).fill(0));
      }
      for (let c = 0; c < n; c++) {
        for (let k = 1; k < n; k++) drow[c][k] = Number((Math.random() * 60).toFixed(2));
      }
      P.push(row);
      D.push(drow);
    }
    const r = generateResults(P, D, n, 5);
    const ref = bruteForceValidTotals(P, D, n, 5);
    if (r.totalCombos !== ref.length) {
      ok = false;
      detail = `trial ${trial}: engine=${r.totalCombos} brute=${ref.length}`;
      break;
    }
  }
  check("pruned search finds every leaf-valid combo", ok, detail);
}

// --- fastMode ---
console.log("fastMode");
{
  const fast = generateResults(P5, D5, 5, 5, false, { fastMode: true });
  check("fixture: fast returns 1 combo (366)", fast.totalCombos === 1 && fast.bestCombo?.total === 366);
  check("fixture: fast saving unchanged", fast.costSaving === 114 && fast.totalLowestBase === 480);
  check("fixture: same top winner", eq(fast.bestCombo?.assignment, res.bestCombo?.assignment));

  let ok = true;
  let detail = "";
  const n = 5;
  for (let trial = 0; trial < 15; trial++) {
    const P: number[][] = [];
    const D: number[][][] = [];
    for (let t = 0; t < 5; t++) {
      const row: number[] = [];
      const drow: number[][] = [];
      for (let c = 0; c < n; c++) {
        row.push(Math.random() < 0.2 ? 0 : Math.floor(Math.random() * 1000) + 100);
        drow.push(Array(n).fill(0));
      }
      for (let c = 0; c < n; c++) {
        for (let k = 1; k < n; k++) drow[c][k] = Number((Math.random() * 60).toFixed(2));
      }
      P.push(row);
      D.push(drow);
    }
    const slow = generateResults(P, D, n, 5);
    const f = generateResults(P, D, n, 5, false, { fastMode: true });
    if (slow.bestCombo === null) {
      if (f.bestCombo !== null) {
        ok = false;
        detail = `trial ${trial}: slow null, fast non-null`;
        break;
      }
    } else {
      if (f.bestCombo === null || f.bestCombo.total !== slow.bestCombo.total) {
        ok = false;
        detail = `trial ${trial}: slow=${slow.bestCombo.total} fast=${f.bestCombo?.total}`;
        break;
      }
      for (const c of f.combinations) {
        if (c.total !== slow.bestCombo.total) {
          ok = false;
          detail = `trial ${trial}: fast combo ${c.total} != best ${slow.bestCombo.total}`;
          break;
        }
      }
    }
    if (!ok) break;
  }
  check("fast best always matches slow best (15 random grids)", ok, detail);
}

// --- constraints ---
console.log("constraints");
{
  const r1 = generateResults(P5, D5, 5, 5, false, { forced: [null, null, null, 1, null] });
  check("forced C3->B keeps 366, all combos have B on C3", r1.bestCombo?.total === 366 && r1.combinations.every((c) => c.assignment[3] === 1));

  const forbidden = Array.from({ length: 5 }, (_, t) => Array.from({ length: 5 }, (_, c) => t === 3 && c === 0));
  const r2 = generateResults(P5, D5, 5, 5, false, { forbidden });
  check("forbid D on C0 -> best remains 366 and no result uses D/C0", r2.totalCombos === 2 && r2.bestCombo?.total === 366 && r2.combinations.every((c) => c.assignment[0] !== 3));

  const r3 = generateResults(P5, D5, 5, 5, false, { maxWins: [2, 5, 5, 5, 5] });
  check("maxWins A=2 -> best 426, A capped", r3.bestCombo?.total === 426 && r3.combinations.every((c) => c.tendererCounts[0] <= 2));

  const Pn = P5.map((row, t) => (t === 4 ? row.map(() => 0) : row));
  const r4 = generateResults(Pn, D5, 5, 5, false, { forced: [4, null, null, null, null] });
  check("forced non-bidder -> infeasible, no crash", r4.totalCombos === 0 && r4.bestCombo === null);
}

// --- projection + niche ---
console.log("projection");
{
  const n = 6;
  const m = 3;
  const P: number[][] = [
    [0, 10, 10, 0, 0, 0],
    [100, 100, 100, 100, 100, 100],
    [200, 200, 200, 200, 200, 200],
  ];
  const D: number[][][] = [
    [
      [0, 0, 0, 0, 0, 0],
      [0, 90, 0, 0, 0, 0],
      [0, 90, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ],
    Array(n).fill(null).map(() => Array(n).fill(0)),
    Array(n).fill(null).map(() => Array(n).fill(0)),
  ];
  const selected = [1, 2, 4, 5];
  const proj = projectToSelectedContracts(P, D, selected);
  check("projection cCount=4, indexMap correct", proj.cCount === 4 && eq(proj.indexMap, selected));
  check("projected prices row T0 = [10,10,0,0]", eq(proj.prices[0], [10, 10, 0, 0]));
  const ladderOk = proj.discounts.every((row) => row.every((l) => l.length === 4));
  check("ladders reindexed to length 4", ladderOk);

  const r = generateResults(proj.prices, proj.discounts, proj.cCount, m);
  const ref = bruteForceValidTotals(proj.prices, proj.discounts, proj.cCount, m);
  check("projected result matches brute force", r.totalCombos === ref.length, `engine=${r.totalCombos} brute=${ref.length}`);
  check("TLB = 220, best total = 202", r.totalLowestBase === 220 && r.bestCombo?.total === 202);
  check("niche detected (bid 2 of 4, won all)", r.bestCombo?.isNicheOptimization === true && r.nicheCombos.length === 1);

  const forced = [1, null, null];
  const forb = [
    [false, true, false],
    [false, false, false],
  ];
  const P2: number[][] = [
    [10, 20, 30],
    [15, 25, 35],
  ];
  const D2: number[][][] = [
    Array(3).fill(null).map(() => Array(3).fill(0)),
    Array(3).fill(null).map(() => Array(3).fill(0)),
  ];
  const proj2 = projectToSelectedContracts(P2, D2, [0, 2], forced, forb);
  check("forced/forbidden projected onto subset", eq(proj2.forced, [1, null]) && eq(proj2.forbidden, [[false, false], [false, false]]));
}

// --- NaN safety ---
console.log("NaN safety");
{
  const Dshort: number[][][] = [
    [[0, 50]],
    [[0, 30, 0, 0, 0]],
    [[0, 0, 0, 0, 0]],
    [[0, 0, 0, 0, 0]],
    [[0, 0, 0, 0, 0]],
  ].map((row) => Array(5).fill(null).map(() => row[0]));
  for (const avgDop of [false, true]) {
    const r = generateResults(P5, Dshort, 5, 5, avgDop);
    const ref = bruteForceValidTotals(r.prices, r.discounts, 5, 5);
    let ok = r.bestCombo !== null && r.totalCombos === ref.length;
    if (ref.length > 0 && r.bestCombo!.total !== ref[0].total) ok = false;
    for (const c of r.combinations) {
      if (!Number.isFinite(c.total) || c.contractCosts.some((x) => !Number.isFinite(x))) ok = false;
    }
    check(`short ladder, avgDop=${avgDop}: finite, matches brute force`, ok, `best=${r.bestCombo?.total}`);
  }
  const P3 = P5.map((row, t) => (t === 4 ? row.map(() => 0) : row));
  const r = generateResults(P3, D5, 5, 5, true);
  check("avgDop with empty bid row: finite", Number.isFinite(r.totalLowestBase) && r.combinations.every((c) => Number.isFinite(c.total)));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
