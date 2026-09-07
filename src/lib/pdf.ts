// Text-based jsPDF report for alliance results.
//
// Pure text mode only: everything is drawn with doc.text / doc.line. No
// autotable, no html2canvas, no images — so this module has no dependencies
// beyond jspdf itself.
//
// Layout (A4, points):
//   Page 1 (portrait): title + generation timestamp, summary block
//     (totalLowestBase, best total, cost saving, valid combo count, search
//     stats), best-combination table (contract / tenderer / cost) with the
//     per-tenderer win counts.
//   Subsequent pages (landscape): every enumerated combination as one row —
//     rank, total, per-contract winner initials, per-contract costs, flags
//     (Best / Niche) — paginated with the header repeated.
//   Final section (landscape): niche combinations, if any.

import { jsPDF } from "jspdf";
import type { Results } from "./alliance-combinations";
import { formatMoney } from "./currency";

export interface PdfReportOptions {
  title?: string;
  tendererNames?: string[];
  contractNames?: string[];
}

// A4 page dimensions in points.
const A4_PORTRAIT = { w: 595.28, h: 841.89 };
const A4_LANDSCAPE = { w: 841.89, h: 595.28 };
const MARGIN = 36;

type Orientation = "portrait" | "landscape";

interface Ctx {
  doc: jsPDF;
  orient: Orientation;
}

interface Column {
  label: string;
  w: number;
  align: "left" | "center" | "right";
}

const pageDims = (o: Orientation): { w: number; h: number } =>
  o === "landscape" ? A4_LANDSCAPE : A4_PORTRAIT;

const usableWidth = (o: Orientation): number => pageDims(o).w - 2 * MARGIN;

const bottomY = (ctx: Ctx): number => pageDims(ctx.orient).h - MARGIN;

/** Add a fresh page in ctx orientation; returns the y for the first content. */
const freshPage = (ctx: Ctx): number => {
  ctx.doc.addPage("a4", ctx.orient);
  return MARGIN + 12;
};

/** True when this row does not fit below y on the current page. */
const needsBreak = (ctx: Ctx, y: number, needed: number): boolean =>
  y + needed > bottomY(ctx);

const anchorX = (x: number, col: Column): number =>
  col.align === "right" ? x + col.w - 2 : col.align === "center" ? x + col.w / 2 : x + 2;

/** Scale columns proportionally so the table fits the usable page width. */
const fitColumns = (cols: Column[], usable: number): Column[] => {
  const total = cols.reduce((a, c) => a + c.w, 0);
  if (total <= usable) return cols;
  const k = usable / total;
  return cols.map((c) => ({ ...c, w: c.w * k }));
};

/** Truncate a header label so it fits its (scaled) column width. */
const fitLabel = (ctx: Ctx, label: string, col: Column, fontSize: number): string => {
  const maxW = col.w - 4;
  if (maxW <= 8) return label.length > 1 ? label.slice(0, 2) + "." : label;
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(fontSize);
  if (ctx.doc.getTextWidth(label) <= maxW) return label;
  let s = label;
  while (s.length > 1 && ctx.doc.getTextWidth(s + "...") > maxW) {
    s = s.slice(0, -1);
  }
  return s + "...";
};

/**
 * Draw a table: bold header row + one line per data row, paginating as needed
 * (the header is repeated on each new page). Returns the y just below the
 * last drawn row. `firstHeaderY` is the text baseline of the header on the
 * current page.
 */
const drawTable = (
  ctx: Ctx,
  cols: Column[],
  rows: string[][],
  firstHeaderY: number,
  rowHeight: number,
  fontSize: number
): number => {
  const scaled = fitColumns(cols, usableWidth(ctx.orient));
  const x0 = MARGIN;
  const width = scaled.reduce((a, c) => a + c.w, 0);

  const drawHeader = (y: number): number => {
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.setFontSize(fontSize);
    let cx = x0;
    for (const col of scaled) {
      ctx.doc.text(fitLabel(ctx, col.label, col, fontSize), anchorX(cx, col), y, { align: col.align });
      cx += col.w;
    }
    ctx.doc.setLineWidth(0.5);
    ctx.doc.line(x0, y + 3, x0 + width, y + 3);
    return y + rowHeight;
  };

  let y = drawHeader(firstHeaderY);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(fontSize);
  for (const row of rows) {
    if (needsBreak(ctx, y, rowHeight)) y = drawHeader(freshPage(ctx));
    let cx = x0;
    for (let i = 0; i < scaled.length; i++) {
      ctx.doc.text(row[i] ?? "", anchorX(cx, scaled[i]), y, { align: scaled[i].align });
      cx += scaled[i].w;
    }
    y += rowHeight;
  }
  return y;
};

const defaultTendererLabel = (t: number): string =>
  t < 26 ? String.fromCharCode(65 + t) : `T${t + 1}`;

const tendererLabel = (names: string[] | undefined, t: number): string => {
  const nm = names?.[t];
  if (typeof nm === "string" && nm.trim() !== "") return nm.trim();
  return defaultTendererLabel(t);
};

const tendererInitial = (names: string[] | undefined, t: number): string =>
  tendererLabel(names, t).charAt(0).toUpperCase() || defaultTendererLabel(t);

const contractLabel = (names: string[] | undefined, c: number): string => {
  const nm = names?.[c];
  if (typeof nm === "string" && nm.trim() !== "") return nm.trim();
  return `C${c + 1}`;
};

/**
 * Generate a PDF report of the alliance results as a Blob.
 * Currency comes from opts (default "GBP"); names fall back to A/B/C... and C1/C2/...
 */
export const generateResultsPdf: (results: Results, opts?: PdfReportOptions) => Promise<Blob> =
  async (results: Results, opts: PdfReportOptions = {}): Promise<Blob> => {
    const tendererNames = opts.tendererNames;
    const contractNames = opts.contractNames;
    const money = (v: number): string => formatMoney(v);

    const m = results.prices.length;
    const n = results.prices[0]?.length ?? 0;
    const title = opts.title?.trim() ? opts.title.trim() : "Alliance Results";

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const ctxP: Ctx = { doc, orient: "portrait" };

    let y = MARGIN + 12;

    // --- Title + generation timestamp ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, MARGIN, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toISOString()}`, MARGIN, y);
    y += 12;
    doc.line(MARGIN, y, A4_PORTRAIT.w - MARGIN, y);
    y += 18;

    // --- Summary block ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("SUMMARY", MARGIN, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const summary: Array<[string, string]> = [
      ["Total lowest base (standalone bids)", money(results.totalLowestBase)],
      ["Best alliance total (selected, discounted)", money(results.totalSelectedDiscounted)],
      ["Cost saving", money(results.costSaving)],
      ["Valid combinations", String(results.totalCombos)],
    ];
    for (const [k, v] of summary) {
      doc.text(k, MARGIN, y);
      doc.text(v, MARGIN + 220, y, { align: "left" });
      y += 14;
    }
    y += 2;
    doc.text(
      `Search stats: ${results.stats.nodesVisited} nodes visited, ${results.stats.leavesEvaluated} leaves evaluated, ` +
        `${results.stats.prunedNodes} pruned, ${results.stats.elapsedMs} ms elapsed`,
      MARGIN,
      y
    );
    y += 20;

    // --- Best combination table ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("BEST COMBINATION", MARGIN, y);
    y += 6;
    if (results.bestCombo) {
      const best = results.bestCombo;
      const cols: Column[] = [
        { label: "Contract", w: 200, align: "left" },
        { label: "Tenderer", w: 160, align: "left" },
        { label: "Cost", w: 140, align: "right" },
      ];
      const rows: string[][] = [];
      for (let c = 0; c < n; c++) {
        const t = best.assignment[c];
        const assigned = t != null && t >= 0 && t < m;
        rows.push([
          contractLabel(contractNames, c),
          assigned ? tendererLabel(tendererNames, t) : "-",
          assigned ? money(best.contractCosts[c] ?? 0) : "-",
        ]);
      }
      y = drawTable(ctxP, cols, rows, y, 14, 9);
      const winSummary = Array.from({ length: m }, (_, t) =>
        `${tendererLabel(tendererNames, t)}: ${best.tendererCounts[t] ?? 0}`
      ).join(",  ");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      if (needsBreak(ctxP, y, 16)) y = freshPage(ctxP);
      doc.text(`Win counts: ${winSummary}`, MARGIN, y);
      y += 16;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("No valid combinations were found.", MARGIN, y);
      y += 14;
    }

    // --- All enumerated combinations (landscape pages) ---
    doc.addPage("a4", "landscape");
    const ctxL: Ctx = { doc, orient: "landscape" };
    let yL = MARGIN + 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`ALL COMBINATIONS (${results.combinations.length})`, MARGIN, yL);
    yL += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Columns: rank, total, then per-contract winner and cost, then flags (Best / Niche).", MARGIN, yL);
    yL += 12;

    if (results.combinations.length > 0) {
      const cols: Column[] = [
        { label: "#", w: 26, align: "left" },
        { label: "Total", w: 72, align: "right" },
        ...Array.from({ length: n }, (_, c): Column => ({
          label: contractLabel(contractNames, c),
          w: 20,
          align: "center",
        })),
        ...Array.from({ length: n }, (_, c): Column => ({
          label: `${contractLabel(contractNames, c)} $`,
          w: 48,
          align: "right",
        })),
        { label: "Flags", w: 52, align: "left" },
      ];
      const rows = results.combinations.map((combo, i): string[] => {
        const flags: string[] = [];
        if (combo.isGlobalBest) flags.push("Best");
        if (combo.isNicheOptimization) flags.push("Niche");
        const row: string[] = [String(i + 1), money(combo.total)];
        for (let c = 0; c < n; c++) {
          const t = combo.assignment[c];
          row.push(t != null && t >= 0 && t < m ? tendererInitial(tendererNames, t) : "-");
        }
        for (let c = 0; c < n; c++) {
          const t = combo.assignment[c];
          row.push(t != null && t >= 0 && t < m ? money(combo.contractCosts[c] ?? 0) : "-");
        }
        row.push(flags.join("/"));
        return row;
      });
      yL = drawTable(ctxL, cols, rows, yL, 13, 7);
    }

    // --- Final section: niche combinations, if any ---
    if (results.nicheCombos.length > 0) {
      yL += 10;
      if (needsBreak(ctxL, yL, 40)) yL = freshPage(ctxL);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`NICHE COMBINATIONS (${results.nicheCombos.length})`, MARGIN, yL);
      yL += 18;
      const cols: Column[] = [
        { label: "#", w: 30, align: "left" },
        { label: "Total", w: 72, align: "right" },
        { label: "Assignment", w: 320, align: "left" },
        { label: "Win counts", w: 320, align: "left" },
      ];
      const rows = results.nicheCombos.map((combo): string[] => {
        // nicheCombos are the same Combination objects as in `combinations`.
        let rank = results.combinations.indexOf(combo) + 1;
        if (rank < 1) {
          rank =
            results.combinations.findIndex(
              (c) =>
                c.total === combo.total &&
                JSON.stringify(c.assignment) === JSON.stringify(combo.assignment)
            ) + 1;
        }
        const assignment = Array.from({ length: n }, (_, c) => {
          const t = combo.assignment[c];
          return `${contractLabel(contractNames, c)}: ${t != null && t >= 0 && t < m ? tendererLabel(tendererNames, t) : "-"}`;
        }).join(", ");
        const winCounts = Array.from({ length: m }, (_, t) =>
          `${tendererLabel(tendererNames, t)}: ${combo.tendererCounts[t] ?? 0}`
        ).join(", ");
        return [rank > 0 ? String(rank) : "-", money(combo.total), assignment, winCounts];
      });
      yL = drawTable(ctxL, cols, rows, yL, 14, 7);
    }

    return doc.output("blob");
  };

/**
 * Generate the report and trigger a browser download named from opts.title
 * (fallback "alliance-results.pdf"). Creates a Blob URL, clicks a programmatic
 * <a>, and revokes the URL. Browser-only.
 */
export const downloadResultsPdf: (results: Results, opts?: PdfReportOptions) => void = (
  results: Results,
  opts: PdfReportOptions = {}
): void => {
  if (typeof document === "undefined") {
    throw new Error("downloadResultsPdf requires a DOM environment (browser)");
  }
  const base = (opts.title ?? "").trim();
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const filename = safe ? `${safe}.pdf` : "alliance-results.pdf";

  void generateResultsPdf(results, opts).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
};
