// CSV import/export for alliance price + discount grids.
//
// On-disk format (v1) — a small sectioned, human-readable layout:
//
//   # ALLIANCE-GRID v1
//   # CONTRACTS <n>
//   # TENDERERS <m>
//   # TENDERER-NAMES            (optional, one row of m quoted names)
//   "A","B",...
//   # CONTRACT-NAMES            (optional, one row of n quoted names)
//   "C1","C2",...
//   # PRICES                    (m rows x n bare numeric fields; 0 = no bid)
//   12.34,100,0
//   ...
//   # DISCOUNTS                 (m rows x n cells; each cell is a ";"-joined
//                                DoP ladder, tier index = win count - 1)
//   0;10;25,0,0
//   ...
//
// Numbers are never quoted and never contain commas (JS numbers stringify
// without thousands separators), so numeric rows are plain comma lists.
// Names are always double-quoted, with embedded quotes doubled ("") so any
// name — including ones containing commas or quotes — round-trips exactly.
//
// parseCsvToGrid is lenient about a leading BOM and extra blank lines, but
// throws descriptive Errors (never NaN) on structural problems: row-length
// mismatch, non-numeric price cells, negative values, and ladder values
// outside 0..100.

export interface CsvGrid {
  contracts: number;
  tenderers: number;
  prices: number[][]; // rows = tenderers, cols = contracts
  discounts: number[][][]; // tenderer -> contract -> ladder of tier values
}

interface GridInput {
  contracts: number;
  tenderers: number;
  prices: number[][];
  discounts: number[][][];
  tendererNames?: string[];
  contractNames?: string[];
}

const HEADER = "# ALLIANCE-GRID v1";
const S_TENDERER_NAMES = "# TENDERER-NAMES";
const S_CONTRACT_NAMES = "# CONTRACT-NAMES";
const S_PRICES = "# PRICES";
const S_DISCOUNTS = "# DISCOUNTS";
const D_CONTRACTS = "# CONTRACTS";
const D_TENDERERS = "# TENDERERS";

/** Double-quote a text field for CSV, doubling any embedded quotes. */
function quoteField(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"';
}

/** Parse one CSV line into fields, honouring double-quoted fields and "" escapes. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function validateGrid(g: GridInput): void {
  const n = g.contracts;
  const m = g.tenderers;
  if (!Number.isInteger(n) || n < 0) throw new Error(`gridToCsv: contracts must be a non-negative integer, got ${n}`);
  if (!Number.isInteger(m) || m < 0) throw new Error(`gridToCsv: tenderers must be a non-negative integer, got ${m}`);
  if (g.tendererNames && g.tendererNames.length !== m) {
    throw new Error(`gridToCsv: tendererNames length ${g.tendererNames.length} != tenderers ${m}`);
  }
  if (g.contractNames && g.contractNames.length !== n) {
    throw new Error(`gridToCsv: contractNames length ${g.contractNames.length} != contracts ${n}`);
  }
  if (!Array.isArray(g.prices) || g.prices.length !== m) {
    throw new Error(`gridToCsv: prices must have ${m} rows, got ${Array.isArray(g.prices) ? g.prices.length : "non-array"}`);
  }
  for (let t = 0; t < m; t++) {
    const row = g.prices[t];
    if (!Array.isArray(row) || row.length !== n) {
      throw new Error(`gridToCsv: prices row ${t} must have ${n} values, got ${Array.isArray(row) ? row.length : "non-array"}`);
    }
    for (let c = 0; c < n; c++) {
      const v = row[c];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error(`gridToCsv: prices[${t}][${c}] is not a finite number`);
      }
      if (v < 0) throw new Error(`gridToCsv: prices[${t}][${c}] is negative (${v})`);
    }
  }
  if (!Array.isArray(g.discounts) || g.discounts.length !== m) {
    throw new Error(`gridToCsv: discounts must have ${m} rows, got ${Array.isArray(g.discounts) ? g.discounts.length : "non-array"}`);
  }
  for (let t = 0; t < m; t++) {
    const row = g.discounts[t];
    if (!Array.isArray(row) || row.length !== n) {
      throw new Error(`gridToCsv: discounts row ${t} must have ${n} ladders, got ${Array.isArray(row) ? row.length : "non-array"}`);
    }
    for (let c = 0; c < n; c++) {
      const ladder = row[c];
      if (!Array.isArray(ladder) || ladder.length === 0) {
        throw new Error(`gridToCsv: discounts[${t}][${c}] must be a non-empty ladder`);
      }
      for (let d = 0; d < ladder.length; d++) {
        const v = ladder[d];
        if (typeof v !== "number" || !Number.isFinite(v)) {
          throw new Error(`gridToCsv: discounts[${t}][${c}][${d}] is not a finite number`);
        }
        if (v < 0 || v > 100) {
          throw new Error(`gridToCsv: discounts[${t}][${c}][${d}] is out of range 0..100 (${v})`);
        }
      }
    }
  }
}

/** Serialize a grid (and optional names) to the v1 CSV format. */
export const gridToCsv: (
  g: GridInput
) => string = (g: GridInput): string => {
  validateGrid(g);
  const n = g.contracts;
  const m = g.tenderers;
  const lines: string[] = [HEADER, `${D_CONTRACTS} ${n}`, `${D_TENDERERS} ${m}`];
  if (g.tendererNames) {
    lines.push(S_TENDERER_NAMES, g.tendererNames.map(quoteField).join(","));
  }
  if (g.contractNames) {
    lines.push(S_CONTRACT_NAMES, g.contractNames.map(quoteField).join(","));
  }
  lines.push(S_PRICES);
  for (let t = 0; t < m; t++) {
    lines.push(g.prices[t].map((v) => String(v)).join(","));
  }
  lines.push(S_DISCOUNTS);
  for (let t = 0; t < m; t++) {
    lines.push(g.discounts[t].map((ladder) => ladder.map((v) => String(v)).join(";")).join(","));
  }
  return lines.join("\n") + "\n";
};

/** Parse v1 CSV text back into a CsvGrid. Throws descriptive Errors on malformed input. */
export const parseCsvToGrid: (text: string) => CsvGrid = (text: string): CsvGrid => {
  if (typeof text !== "string") throw new Error("parseCsvToGrid: input must be a string");
  // Lenient about a leading BOM and extra blank lines.
  const lines: string[] = [];
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    lines.push(trimmed);
  }
  if (lines.length === 0) throw new Error("parseCsvToGrid: empty input");
  if (lines[0] !== HEADER) throw new Error(`parseCsvToGrid: missing header '${HEADER}'`);

  let contracts = -1;
  let tenderers = -1;
  let idx = 1;

  // Read the two dimension directives (in either order).
  while (idx < lines.length) {
    const line = lines[idx];
    if (line.startsWith(D_CONTRACTS)) {
      const v = Number(line.slice(D_CONTRACTS.length).trim());
      if (!Number.isInteger(v) || v < 0) throw new Error(`parseCsvToGrid: invalid CONTRACTS value '${line.slice(D_CONTRACTS.length).trim()}'`);
      contracts = v;
      idx++;
    } else if (line.startsWith(D_TENDERERS)) {
      const v = Number(line.slice(D_TENDERERS.length).trim());
      if (!Number.isInteger(v) || v < 0) throw new Error(`parseCsvToGrid: invalid TENDERERS value '${line.slice(D_TENDERERS.length).trim()}'`);
      tenderers = v;
      idx++;
    } else {
      break;
    }
  }
  if (contracts < 0) throw new Error("parseCsvToGrid: missing or invalid CONTRACTS directive");
  if (tenderers < 0) throw new Error("parseCsvToGrid: missing or invalid TENDERERS directive");

  // Optional tenderer names (single row of exactly `tenderers` quoted fields).
  if (idx < lines.length && lines[idx] === S_TENDERER_NAMES) {
    idx++;
    if (idx >= lines.length) throw new Error("parseCsvToGrid: TENDERER-NAMES section is empty");
    const fields = parseCsvLine(lines[idx]);
    idx++;
    if (fields.length !== tenderers) {
      throw new Error(`parseCsvToGrid: TENDERER-NAMES has ${fields.length} fields, expected ${tenderers}`);
    }
  }

  // Optional contract names (single row of exactly `contracts` quoted fields).
  if (idx < lines.length && lines[idx] === S_CONTRACT_NAMES) {
    idx++;
    if (idx >= lines.length) throw new Error("parseCsvToGrid: CONTRACT-NAMES section is empty");
    const fields = parseCsvLine(lines[idx]);
    idx++;
    if (fields.length !== contracts) {
      throw new Error(`parseCsvToGrid: CONTRACT-NAMES has ${fields.length} fields, expected ${contracts}`);
    }
  }

  // PRICES: exactly `tenderers` rows, each with exactly `contracts` numeric fields.
  if (idx >= lines.length || lines[idx] !== S_PRICES) {
    throw new Error("parseCsvToGrid: missing '# PRICES' section");
  }
  idx++;
  const prices: number[][] = [];
  for (let t = 0; t < tenderers; t++) {
    if (idx >= lines.length || lines[idx].startsWith("#")) {
      throw new Error(`parseCsvToGrid: PRICES section has fewer than ${tenderers} rows`);
    }
    const fields = parseCsvLine(lines[idx]);
    idx++;
    if (fields.length !== contracts) {
      throw new Error(`parseCsvToGrid: prices row ${t} has ${fields.length} fields, expected ${contracts} (row length mismatch)`);
    }
    const row: number[] = [];
    for (let c = 0; c < contracts; c++) {
      const cell = fields[c];
      const v = Number(cell);
      if (!Number.isFinite(v)) {
        throw new Error(`parseCsvToGrid: non-numeric price cell '${cell}' at row ${t}, col ${c}`);
      }
      if (v < 0) throw new Error(`parseCsvToGrid: negative price ${v} at row ${t}, col ${c}`);
      row.push(v);
    }
    prices.push(row);
  }

  // DISCOUNTS: exactly `tenderers` rows, each `contracts` cells; each cell is a
  // ";"-joined ladder whose tiers are numbers in 0..100.
  if (idx >= lines.length || lines[idx] !== S_DISCOUNTS) {
    throw new Error("parseCsvToGrid: missing '# DISCOUNTS' section");
  }
  idx++;
  const discounts: number[][][] = [];
  for (let t = 0; t < tenderers; t++) {
    if (idx >= lines.length || lines[idx].startsWith("#")) {
      throw new Error(`parseCsvToGrid: DISCOUNTS section has fewer than ${tenderers} rows`);
    }
    const fields = parseCsvLine(lines[idx]);
    idx++;
    if (fields.length !== contracts) {
      throw new Error(`parseCsvToGrid: discounts row ${t} has ${fields.length} fields, expected ${contracts} (row length mismatch)`);
    }
    const row: number[][] = [];
    for (let c = 0; c < contracts; c++) {
      const cell = fields[c];
      if (cell === "") throw new Error(`parseCsvToGrid: empty discount ladder at row ${t}, col ${c}`);
      const parts = cell.split(";");
      const ladder: number[] = [];
      for (let d = 0; d < parts.length; d++) {
        const v = Number(parts[d]);
        if (!Number.isFinite(v)) {
          throw new Error(`parseCsvToGrid: non-numeric discount tier '${parts[d]}' at row ${t}, col ${c}, tier ${d}`);
        }
        if (v < 0 || v > 100) {
          throw new Error(`parseCsvToGrid: discount tier ${v} out of range 0..100 at row ${t}, col ${c}, tier ${d}`);
        }
        ladder.push(v);
      }
      row.push(ladder);
    }
    discounts.push(row);
  }

  return { contracts, tenderers, prices, discounts };
};
