"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, FlaskConical, Loader2, X, isSelectedIn, resultColumnFor } from "./shared";
import type { ResultsView, WhatIf, WhatIfChange } from "./shared";

export function WhatIfCard({
  view,
  whatIf,
  setWhatIf,
  onCompute,
  isCalculating,
}: {
  view: ResultsView;
  whatIf: WhatIf | null;
  setWhatIf: (w: WhatIf | null) => void;
  onCompute: () => void;
  isCalculating: boolean;
}) {
  const bidableContracts = Array.from({ length: view.contracts }, (_, c) => c).filter(
    (c) => {
      const resultColumn = resultColumnFor(view, c);
      return (
        isSelectedIn(view, c) &&
        resultColumn >= 0 &&
        (view.results.prices[whatIf?.changes[0]?.t ?? 0]?.[resultColumn] ?? 0) > 0
      );
    }
  );
  const tierCount = view.selectedContracts.length > 0 ? view.selectedContracts.length : view.contracts;
  const validContractsFor = (t: number) => Array.from({ length: view.contracts }, (_, c) => c).filter((c) => {
    const rc = resultColumnFor(view, c);
    return isSelectedIn(view, c) && rc >= 0 && (view.results.prices[t]?.[rc] ?? 0) > 0;
  });

  const select =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const changes = whatIf?.changes ?? [];
  const addChange = () => setWhatIf({ changes: [...changes, { t: 0, c: bidableContracts[0] ?? 0, tier: 0, deltaPct: 0 }], applied: false });
  const updateChange = (index: number, patch: Partial<WhatIfChange>) => setWhatIf({ changes: changes.map((change, i) => i === index ? { ...change, ...patch } : change), applied: false });
  const removeChange = (index: number) => {
    const next = changes.filter((_, i) => i !== index);
    setWhatIf(next.length ? { changes: next, applied: false } : null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          What-If Scenario
        </CardTitle>
        <CardDescription>
          Model one or more discount changes together and see the best configuration update. The live grid is untouched.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {whatIf && changes.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-[#00B2CA]/25 bg-[#00B2CA]/5 px-3 py-2 text-sm">
            <span className="font-medium text-[#008da2]">Scenario active</span>
            <span className="text-muted-foreground">{changes.length} change{changes.length === 1 ? "" : "s"} configured</span>
          </div>
        )}
        {changes.map((change, index) => <div key={index} className="relative grid gap-3 rounded-md border p-3 pr-12 sm:grid-cols-2 md:grid-cols-4">
          <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeChange(index)} aria-label={`Remove change ${index + 1}`} title="Remove this change">
            <X className="h-4 w-4" />
          </Button>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Tenderer</span>
            <select
              className={select}
              value={change.t}
               onChange={(e) => {
                 const nextT = Number(e.target.value);
                 const valid = validContractsFor(nextT);
                 updateChange(index, { t: nextT, c: valid.includes(change.c) ? change.c : (valid[0] ?? 0) });
               }}
            >
              {Array.from({ length: view.tenderers }).map((_, t) => (
                <option key={t} value={t}>
                  {view.tendererNames[t] || `T${t + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Contract</span>
            <select
              className={select}
              value={change.c}
              onChange={(e) => updateChange(index, { c: Number(e.target.value) })}
            >
              {validContractsFor(change.t).map((c) => (
                <option key={c} value={c}>
                  {view.contractNames[c] || `C${c + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Ladder DoP</span>
            <select
              className={select}
              value={change.tier}
              onChange={(e) => updateChange(index, { tier: Number(e.target.value) })}
            >
              {Array.from({ length: tierCount }).map((_, d) => (
                <option key={d} value={d}>
                  DoP {d + 1}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Discount adjustment</span>
            <input
              type="number"
              min={-100}
              max={100}
              step={0.5}
              className={select}
              value={change.deltaPct}
              onChange={(e) => {
                const v = Number(e.target.value);
                updateChange(index, { deltaPct: Number.isFinite(v) ? Math.max(-100, Math.min(100, v)) : 0 });
              }}
            />
          </label>
        </div>)}
        <Button variant="outline" size="sm" onClick={addChange}>+ Add change</Button>
        {whatIf?.applied && <div className="rounded-md bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
          <div><span className="font-medium">Scenario result:</span> Best total {view.format(view.results.totalSelectedDiscounted)} · Saving {view.format(view.results.costSaving)}</div>
          {view.results.bestCombo?.assignment && <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {Array.from({ length: view.contracts }, (_, c) => { const rc = resultColumnFor(view, c); const t = rc >= 0 ? (view.results.bestCombo?.assignment?.[rc] ?? -1) : -1; const count = t >= 0 ? (view.results.bestCombo?.tendererCounts?.[t] ?? 1) : 1; const dop = Math.max(0, count - 1); const base = t >= 0 && rc >= 0 ? (view.results.prices?.[t]?.[rc] ?? 0) : 0; const pct = t >= 0 && rc >= 0 ? (view.results.discounts?.[t]?.[rc]?.[dop] ?? 0) : 0; const amount = t >= 0 ? Number((base * (1 - pct / 100)).toFixed(2)) : 0; return <div key={c} className="rounded border border-emerald-200/70 bg-white/60 px-2 py-1.5 text-xs dark:bg-black/10">
              <div><span className="font-medium">{view.contractNames[c] || `C${c + 1}`}</span>: {t >= 0 ? (view.tendererNames[t] || `T${t + 1}`) : "No award"}</div>
              {t >= 0 && <div className="mt-0.5 text-muted-foreground">Base {view.format(base)} · DoP {dop + 1} ({pct}%) · Result {view.format(amount)}</div>}
            </div>})}
          </div>}
        </div>}
        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <span className="text-xs text-muted-foreground">The original bid grid stays unchanged.</span>
          <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWhatIf(null)} disabled={!whatIf}>Delete Scenario</Button>
          <Button onClick={onCompute} disabled={isCalculating}>
            {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply what-if
          </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

