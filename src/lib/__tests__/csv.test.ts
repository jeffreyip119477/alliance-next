import { describe, it, expect } from "vitest";
import { gridToCsv, parseCsvToGrid } from "../csv";

// ---------------------------------------------------------------------------
// Fixture: 4 tenderers x 7 contracts.
//   - several no-bid (0) price cells
//   - fractional prices (12.34, 150.5, 300.75)
//   - ladders of full length (7 tiers) plus one short ladder ([0, 30])
// ---------------------------------------------------------------------------

const P: number[][] = [
  /*T0*/ [12.34, 100, 0, 150.5, 200, 200, 200],
  /*T1*/ [250, 250, 250, 90, 0, 90, 90],
  /*T2*/ [500, 0, 300.75, 500, 500, 500, 500],
  /*T3*/ [0, 100, 100, 500, 500, 0, 500],
];

const full = (a: number, b: number, c: number, d: number, e: number, f: number, g: number): number[] => [a, b, c, d, e, f, g];

const D: number[][][] = [
  /*T0*/ [
    full(0, 10, 20, 30, 40, 50, 60),
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    full(0, 5, 0, 0, 0, 0, 0),
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
  /*T1*/ [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 30], // short ladder: only 2 tiers
    [0, 30, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 30, 60, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
  /*T2*/ [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    full(0, 15, 30, 0, 0, 0, 0),
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
  /*T3*/ [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 25, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
];

const grid = {
  contracts: 7,
  tenderers: 4,
  prices: P,
  discounts: D,
};

describe("csv round-trip", () => {
  it("parseCsvToGrid(gridToCsv(g)) deep-equals g (numbers, dimensions, ladder lengths)", () => {
    const csv = gridToCsv(grid);
    const back = parseCsvToGrid(csv);
    expect(back).toEqual(grid);
    expect(back.contracts).toBe(7);
    expect(back.tenderers).toBe(4);
    expect(back.prices).toEqual(P);
    expect(back.discounts).toEqual(D);
  });

  it("preserves no-bid zeros and fractional prices exactly", () => {
    const back = parseCsvToGrid(gridToCsv(grid));
    expect(back.prices[0][0]).toBe(12.34);
    expect(back.prices[0][2]).toBe(0);
    expect(back.prices[2][2]).toBe(300.75);
    expect(back.prices[3][5]).toBe(0);
    expect(back.discounts[1][2]).toEqual([0, 30]); // short ladder kept as-is
    expect(back.discounts[0][0]).toHaveLength(7); // full ladder kept as-is
  });

  it("survives a BOM, CRLF line endings and extra blank lines", () => {
    const csv = gridToCsv(grid);
    const messy =
      "\uFEFF" +
      "\n\n" +
      csv.split("\n").map((l) => (l === "" ? "" : l + "\r")).join("\n") +
      "\n\n  \n\n";
    expect(parseCsvToGrid(messy)).toEqual(grid);
  });

  it("is deterministic (identical input -> identical output)", () => {
    expect(gridToCsv(grid)).toBe(gridToCsv(grid));
  });
});

describe("csv names", () => {
  const tendererNames = ["Alpha, Inc", "Beta", 'Gamma "G" Ltd', "Delta"];
  const contractNames = ["C1", "C2, Lot 2", "C3", "C4", "C5", "C6", "C7"];
  const named = { ...grid, tendererNames, contractNames };

  it("quotes names containing commas and doubles embedded quotes", () => {
    const csv = gridToCsv(named);
    expect(csv).toContain('"Alpha, Inc"');
    expect(csv).toContain('Gamma ""G"" Ltd');
    expect(csv).toContain('"C2, Lot 2"');
  });

  it("names do not corrupt the grid: parse still deep-equals the bare grid", () => {
    const csv = gridToCsv(named);
    const back = parseCsvToGrid(csv);
    expect(back).toEqual(grid);
  });

  it("rejects a names row with the wrong field count", () => {
    const csv = gridToCsv(named);
    const broken = csv.replace('"Alpha, Inc","Beta",', '"Only",');
    // names row now has 3 fields instead of 4 -> structural error
    expect(() => parseCsvToGrid(broken)).toThrow(/TENDERER-NAMES has 3 fields, expected 4/);
  });
});

describe("csv error handling (descriptive Errors, never NaN)", () => {
  const base = gridToCsv({ ...grid, contracts: 2, tenderers: 2, prices: [[1, 2], [3, 4]], discounts: [[ [0, 0], [0, 0] ], [ [0, 0], [0, 0] ]] });

  it("throws on empty input", () => {
    expect(() => parseCsvToGrid("")).toThrow(/empty input/i);
    expect(() => parseCsvToGrid("\n\n  \n")).toThrow(/empty input/i);
  });

  it("throws on missing grid header", () => {
    expect(() => parseCsvToGrid(base.replace("# ALLIANCE-GRID v1", "# SOMETHING ELSE"))).toThrow(/header/i);
  });

  it("throws on a prices row with the wrong number of fields", () => {
    const broken = base.replace("3,4", "3,4,9");
    expect(() => parseCsvToGrid(broken)).toThrow(/row length mismatch/i);
  });

  it("throws on a non-numeric price cell", () => {
    const broken = base.replace("1,2", "1,abc");
    expect(() => parseCsvToGrid(broken)).toThrow(/non-numeric price/i);
  });

  it("throws on a negative price", () => {
    const broken = base.replace("1,2", "-1,2");
    expect(() => parseCsvToGrid(broken)).toThrow(/negative price/i);
  });

  it("throws on a discount tier outside 0..100", () => {
    const broken = base.replace("0;0,0;0", "0;150,0;0");
    expect(() => parseCsvToGrid(broken)).toThrow(/out of range 0\.\.100/i);
  });

  it("throws on a negative discount tier", () => {
    const broken = base.replace("0;0,0;0", "-5;0,0;0");
    expect(() => parseCsvToGrid(broken)).toThrow(/out of range 0\.\.100/i);
  });

  it("throws on a missing PRICES section", () => {
    const broken = base.replace("# PRICES\n", "");
    expect(() => parseCsvToGrid(broken)).toThrow(/PRICES/);
  });

  it("throws on too few discount rows", () => {
    // Drop one of the two identical discount data rows. Note: gridToCsv
    // appends a trailing newline, so the last array element is "" (a newline
    // artifact) — slicing it off leaves both discount rows intact. Instead we
    // remove the last actual discount row at length - 2.
    const lines = base.split("\n");
    lines.splice(lines.length - 2, 1);
    const broken = lines.join("\n");
    expect(() => parseCsvToGrid(broken)).toThrow(/fewer than 2 rows/);
  });
});
