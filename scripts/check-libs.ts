// Local verification harness for the pure libraries: csv and analytics.
// (pdf.ts is browser/PDF oriented and is verified via `tsc` plus the browser;
// it cannot be loaded here because its relative imports use the extension-less
// form the bundler requires, which Node's type-stripping does not resolve.)
//
// The DSH sandbox blocks the vitest/esbuild child-process toolchain,
// so this script mirrors the vitest invariants in plain Node
// (Node 25 runs .ts directly via type stripping).
// Run: node scripts/check-libs.ts
//
// Exits non-zero if any check fails.

import { gridToCsv, parseCsvToGrid } from "../src/lib/csv.ts";
import { computeWinStats } from "../src/lib/analytics.ts";
import type { Results, Combination } from "../src/lib/alliance-combinations.ts";

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

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const expectError = (name: string, fn: () => void, pattern: RegExp): void => {
  try {
    fn();
    check(name, false, "did not throw");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(name, pattern.test(msg), `threw: ${msg}`);
  }
};

// ---------------------------------------------------------------------------
// Fixture: 4 tenderers x 7 contracts — zeros, fractional prices, full ladders
// plus one short ladder ([0, 30]).
// ---------------------------------------------------------------------------
const P4: number[][] = [
  [12.34, 100, 0, 150.5, 200, 200, 200],
  [250, 250, 250, 90, 0, 90, 90],
  [500, 0, 300.75, 500, 500, 500, 500],
  [0, 100, 100, 500, 500, 0, 500],
];
const D4: number[][][] = [
  [
    [0, 10, 20, 30, 40, 50, 60],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 5, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 30], // short ladder: 2 tiers
    [0, 30, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 30, 60, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 15, 30, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 25, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
];
const grid = { contracts: 7, tenderers: 4, prices: P4, discounts: D4 };

// ---------------------------------------------------------------------------
// csv
// ---------------------------------------------------------------------------
console.log("csv");
{
  const csv = gridToCsv(grid);
  const back = parseCsvToGrid(csv);
  check("round-trip deep-equal (numbers, dims, ladder lengths)", eq(back, grid));
  check("fractions and zeros preserved", back.prices[0][0] === 12.34 && back.prices[0][2] === 0 && back.prices[2][2] === 300.75);
  check("short ladder kept as [0,30]", eq(back.discounts[1][2], [0, 30]) && back.discounts[0][0].length === 7);
  check("deterministic output", gridToCsv(grid) === csv);

  // BOM + CRLF + blank lines are tolerated.
  const messy = "\uFEFF" + csv.split("\n").map((l) => (l === "" ? "" : l + "\r\n")).join("") + "\n\n  \n\n";
  check("lenient about BOM/CRLF/blank lines", eq(parseCsvToGrid(messy), grid));

  // Names: proper quoting, and parsing still yields the bare grid.
  const tendererNames = ["Alpha, Inc", "Beta", 'Gamma "G" Ltd', "Delta"];
  const contractNames = ["C1", "C2, Lot 2", "C3", "C4", "C5", "C6", "C7"];
  const namedCsv = gridToCsv({ ...grid, tendererNames, contractNames });
  check("names quoted with commas/quotes intact", namedCsv.includes('"Alpha, Inc"') && namedCsv.includes('Gamma ""G"" Ltd') && namedCsv.includes('"C2, Lot 2"'));
  check("named CSV still parses to the bare grid", eq(parseCsvToGrid(namedCsv), grid));

  // Error cases (descriptive Errors, never NaN).
  const tiny = gridToCsv({ contracts: 2, tenderers: 2, prices: [[1, 2], [3, 4]], discounts: [[[0, 0], [0, 0]], [[0, 0], [0, 0]]] });
  expectError("empty input throws", () => parseCsvToGrid(""), /empty input/i);
  expectError("missing header throws", () => parseCsvToGrid(tiny.replace("# ALLIANCE-GRID v1", "# SOMETHING ELSE")), /header/i);
  expectError("prices row length mismatch throws", () => parseCsvToGrid(tiny.replace("3,4", "3,4,9")), /row length mismatch/i);
  expectError("non-numeric price throws", () => parseCsvToGrid(tiny.replace("1,2", "1,abc")), /non-numeric price/i);
  expectError("negative price throws", () => parseCsvToGrid(tiny.replace("1,2", "-1,2")), /negative price/i);
  expectError("discount >100 throws", () => parseCsvToGrid(tiny.replace("0;0,0;0", "0;150,0;0")), /out of range 0\.\.100/i);
  expectError("negative discount throws", () => parseCsvToGrid(tiny.replace("0;0,0;0", "-5;0,0;0")), /out of range 0\.\.100/i);
  expectError("missing PRICES throws", () => parseCsvToGrid(tiny.replace("# PRICES\n", "")), /PRICES/);
  expectError("too few discount rows throws", () => {
    const lines = tiny.split("\n");
    // Drop one of the two identical discount data rows (the trailing "" is the
    // final-newline artifact, so the last data row sits at length - 2).
    lines.splice(lines.length - 2, 1);
    parseCsvToGrid(lines.join("\n"));
  }, /fewer than 2 rows/);
  expectError("bad names row count throws", () => parseCsvToGrid(namedCsv.replace('"Alpha, Inc","Beta",', '"Only",')), /TENDERER-NAMES has 3 fields, expected 4/);
}

// ---------------------------------------------------------------------------
// analytics
// ---------------------------------------------------------------------------
console.log("analytics");
{
  // Crafted minimal Results: 2 contracts, 2 active tenderers.
  const combos: Combination[] = [
    { assignment: [0, 1], contractCosts: [100, 90], total: 190, tendererCounts: [1, 1], isGlobalBest: true, isNicheOptimization: true },
    { assignment: [0, 0], contractCosts: [100, 100], total: 200, tendererCounts: [2, 0] },
    { assignment: [1, 1], contractCosts: [110, 110], total: 220, tendererCounts: [0, 2] },
  ];
  const results: Results = {
    totalLowestBase: 210,
    totalSelectedDiscounted: 190,
    costSaving: 20,
    combinations: combos,
    bestCombo: combos[0],
    nicheCombos: [combos[0]],
    totalCombos: 3,
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
  };

  const stats = computeWinStats(results, 3);
  check("returns one entry per tenderer", stats.length === 3);
  const [a, b, c] = stats;
  check("tenderer 0: wins 2, rate 2/3, avg 1, wins 3, top 2", a.winsInCombos === 2 && Math.abs(a.winRate - 2 / 3) < 1e-9 && Math.abs(a.avgWinCount - 1) < 1e-9 && a.totalWins === 3 && a.timesTop === 2, JSON.stringify(a));
  check("tenderer 1: wins 2, rate 2/3, avg 1, wins 3, top 2", b.winsInCombos === 2 && Math.abs(b.winRate - 2 / 3) < 1e-9 && Math.abs(b.avgWinCount - 1) < 1e-9 && b.totalWins === 3 && b.timesTop === 2, JSON.stringify(b));
  check("tenderer 2 (inactive): all zeros, timesTop 0", c.winsInCombos === 0 && c.winRate === 0 && c.avgWinCount === 0 && c.totalWins === 0 && c.timesTop === 0, JSON.stringify(c));

  const half = computeWinStats({ ...results, totalCombos: 4 }, 2);
  check("winRate uses totalCombos (2/4 = 0.5)", Math.abs(half[0].winRate - 0.5) < 1e-9);

  const empty = computeWinStats({ ...results, combinations: [], totalCombos: 0 }, 2);
  check("empty result: all zeros, no NaN", empty.every((s) => s.winsInCombos === 0 && s.winRate === 0 && s.avgWinCount === 0 && s.totalWins === 0 && s.timesTop === 0));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
