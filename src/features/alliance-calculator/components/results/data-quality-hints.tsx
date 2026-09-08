"use client";

import { useMemo, Badge, AlertTriangle, CheckCircle2, lowestBaseFor, resultColumnFor } from "./shared";
import type { ResultsView } from "./shared";

export function DataQualityHints({ view }: { view: ResultsView }) {
  const errors = useMemo(() => {
    const out: string[] = [];
    const lbp = Array.from({ length: view.contracts }, (_, c) => {
      const resultColumn = resultColumnFor(view, c);
      return resultColumn >= 0 ? lowestBaseFor(view.results, resultColumn) : 0;
    });

    for (let c = 0; c < view.contracts; c++) {
      const selected =
        view.selectedContracts.length === 0 || view.selectedContracts.includes(c);
      if (lbp[c] === 0 && selected) {
        out.push(`${view.contractNames[c] || `C${c + 1}`}: no tenderer bids it — it will never be awarded.`);
      }
    }
    return out;
  }, [view]);

  if (view.results.status === "infeasible") {
    const selected = [...view.selectedContracts].sort((a, b) => a - b);
    const missing = view.results.infeasibleContracts.map((c) => selected[c] ?? c);
    return (
      <section className="rounded-md border border-red-500/30 bg-red-500/[0.04] px-4 py-3" role="alert">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-700 dark:text-red-300">No compliant calculation</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {missing.length > 0
            ? `Cannot award: ${missing.map((c) => view.contractNames[c] || `C${c + 1}`).join(", ")}.`
            : "The pins, blocks, caps, or price ceilings leave no valid award."}
        </p>
      </section>
    );
  }

  if (errors.length === 0) {
    return (
      <section className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.035] px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">Data Input Checks</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">No errors found.</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-amber-500/25 bg-amber-500/[0.035] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium">Data Input Checks</span>
          <Badge variant="secondary" className="rounded-full px-2 py-0 text-[11px]">{errors.length}</Badge>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Errors that prevent a valid calculation.</p>
      <div className="mt-3 grid gap-1.5">
        {errors.map((err, i) => <p key={i} className="border-l-2 border-amber-400/60 pl-2.5 text-xs leading-5 text-muted-foreground">{err}</p>)}
      </div>
    </section>
  );
}

