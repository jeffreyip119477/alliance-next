"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Award,
  Trophy,
  FlaskConical,
  GitCompareArrows,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Ban,
  X,
} from "lucide-react";
import type { Results } from "@/lib/alliance-combinations";
import { computeWinStats } from "@/lib/analytics";
import type { WhatIf, WhatIfChange } from "@/hooks/useAllianceCombinations";

export interface ResultsView {
  results: Results;
  tenderers: number;
  contracts: number;
  tendererNames: string[];
  contractNames: string[];
  selectedContracts: number[];
  forced: (number | null)[];
  forbidden: boolean[][];
  showAbbreviated: boolean;
  fastMode: boolean;
  useAverageDOP: boolean;
  format: (value: number, abbreviated?: boolean) => string;
}

const isSelectedIn = (view: ResultsView, c: number) =>
  view.selectedContracts.length === 0 || view.selectedContracts.includes(c);

const lowestBaseFor = (results: Results, c: number, view?: Pick<ResultsView, "forced" | "forbidden">): number => {
  const valid = results.prices
    .map((row, t) => {
      if (view?.forbidden[t]?.[c] === true) return 0;
      if (view?.forced[c] != null && view.forced[c] !== t) return 0;
      return row?.[c];
    })
    .filter((p) => typeof p === "number" && p > 0);
  return valid.length > 0 ? Math.min(...valid) : 0;
};

// Results are calculated from a projected grid when only a subset of
// contracts is selected. In that grid, columns are reindexed densely (for
// example, original contracts 1 and 4 become result columns 0 and 1).
// Convert an original contract index to the corresponding result column
// before reading calculated prices.
const resultColumnFor = (view: ResultsView, contractIndex: number): number =>
  view.selectedContracts.length > 0
    ? [...view.selectedContracts].sort((a, b) => a - b).indexOf(contractIndex)
    : contractIndex;

const lowestBasePrices = (view: ResultsView): number[] =>
  Array.from({ length: view.contracts }, (_, c) => {
    const resultColumn = resultColumnFor(view, c);
    return resultColumn >= 0 ? lowestBaseFor(view.results, resultColumn, view) : 0;
  });

const varianceIndicator = (
  currentCost: number,
  lowestBasePrice: number,
  format: ResultsView["format"],
  showAbbreviated: boolean
) => {
  const variance = Number((lowestBasePrice - currentCost).toFixed(2));
  if (variance > 0) {
    return (
      <div className="mt-0.5 text-[10px] font-bold text-emerald-500">
        Save: +{format(variance, showAbbreviated)}
      </div>
    );
  } else if (variance < 0) {
    return (
      <div className="mt-0.5 text-[10px] font-medium text-red-500">
        Add: {format(Math.abs(variance), showAbbreviated)}
      </div>
    );
  }
  return <div className="mt-0.5 text-[10px] text-muted-foreground">At Base Minimum</div>;
};

/* ---------------- Summary ---------------- */

export function SummaryCard({
  view,
  onToggleAbbreviated,
  onSnapshot,
  hasBaseline,
}: {
  view: ResultsView;
  onToggleAbbreviated: (b: boolean) => void;
  onSnapshot: () => void;
  hasBaseline: boolean;
}) {
  const [showLegend, setShowLegend] = useState(true);
  const { results, format, showAbbreviated } = view;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">Results Summary</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="abbreviated-amounts" className="text-sm">
              Abbreviated
            </Label>
            <Switch
              id="abbreviated-amounts"
              checked={showAbbreviated}
              onCheckedChange={onToggleAbbreviated}
            />
          </div>
          <Button
            variant={hasBaseline ? "secondary" : "ghost"}
            size="sm"
            onClick={onSnapshot}
            title={hasBaseline ? "Comparison baseline saved" : "Keep current results as a comparison baseline"}
            aria-label={hasBaseline ? "Comparison baseline saved" : "Keep current results as a comparison baseline"}
            aria-pressed={hasBaseline}
          >
            <GitCompareArrows className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setShowLegend((v) => !v)}
            aria-label="Toggle legend"
          >
            {showLegend ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showLegend && (
          <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
            <h4 className="mb-2 font-medium">Legend</h4>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div className="flex items-center">
                <div className="mr-2 h-4 w-4 rounded bg-[#FF5E93]/20 dark:bg-[#FF5E93]/30"></div>
                <span>Lowest base price for an individual contract</span>
              </div>
              <div className="flex items-center">
                <div className="mr-2 h-4 w-4 rounded bg-[#00B2CA]/20 dark:bg-[#00B2CA]/30"></div>
                <span>Selected optimal configuration mapping</span>
              </div>
              <div className="flex items-center">
                <Badge className="mr-2 h-4 bg-emerald-500 px-1 py-0 text-[10px] hover:bg-emerald-600">
                  Global Best
                </Badge>
                <span>Cheapest valid configuration</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-800">
            <div className="text-sm text-muted-foreground">Total Lowest Prices</div>
            <div className="text-2xl font-bold">
              {format(results.totalLowestBase, showAbbreviated)}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-800">
            <div className="text-sm text-muted-foreground">Total Selected Discounted</div>
            <div className="text-2xl font-bold">
              {format(results.totalSelectedDiscounted, showAbbreviated)}
            </div>
          </div>
          <div className="rounded-lg border bg-[#00B2CA]/10 p-4 shadow-sm dark:bg-[#00B2CA]/20">
            <div className="text-sm text-muted-foreground dark:text-gray-400">Cost Saving</div>
            <div className="text-2xl font-bold text-[#00B2CA]">
              {format(results.costSaving, showAbbreviated)}
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

/* ---------------- Base prices reference ---------------- */

export function BasePricesReferenceCard({ view }: { view: ResultsView }) {
  const lbp = useMemo(() => lowestBasePrices(view), [view]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base Prices Reference</CardTitle>
        <CardDescription>
          The lowest standalone base price per contract (pink) is the validity
          ceiling for every configuration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-medium dark:bg-gray-900">
                  Tenderer
                </th>
                {Array.from({ length: view.contracts }).map((_, c) => (
                  <th
                    key={c}
                    className={`min-w-24 px-2 py-2 text-left font-medium ${!isSelectedIn(view, c) ? "opacity-50" : ""}`}
                  >
                    {view.contractNames[c] || `C${c + 1}`}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: view.tenderers }).map((_, t) => {
                const row = view.results.prices[t] ?? [];
                const total = Array.from({ length: view.contracts }).reduce<number>((sum, _, c) => {
                  const resultColumn = resultColumnFor(view, c);
                  return resultColumn >= 0 ? sum + (row[resultColumn] || 0) : sum;
                }, 0);
                return (
                  <tr key={t} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5 font-medium dark:bg-gray-900">
                      {view.tendererNames[t] || `T${t + 1}`}
                    </td>
                    {Array.from({ length: view.contracts }).map((_, c) => {
                      const resultColumn = resultColumnFor(view, c);
                      const price = resultColumn >= 0 ? row[resultColumn] || 0 : 0;
                      const isLowest = price > 0 && price === lbp[c];
                      const isBlocked = view.forbidden[t]?.[c] === true;
                      return (
                        <td
                          key={c}
                          className={`${isBlocked ? "bg-red-500/15 text-red-600 dark:text-red-400" : isLowest ? "bg-[#FF5E93]/20 dark:bg-[#FF5E93]/30" : ""} ${!isSelectedIn(view, c) ? "opacity-50" : ""} px-2 py-1.5`}
                        >
                          {isBlocked
                            ? <span className="inline-flex items-center gap-1 text-xs font-medium"><Ban className="h-3.5 w-3.5" /> Blocked</span>
                            : price > 0
                            ? view.format(price, view.showAbbreviated)
                            : "Declined"}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right font-bold">
                      {view.format(total, view.showAbbreviated)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Discount matrix breakdown ---------------- */

export function DiscountMatrixCard({ view }: { view: ResultsView }) {
  const lbp = useMemo(() => lowestBasePrices(view), [view]);
  const tierCount =
    view.selectedContracts.length > 0 ? view.selectedContracts.length : view.contracts;

  return (
    <Card className="border-[#00B2CA]/25">
      <CardHeader className="pb-4">
        <CardTitle>Discounts and Amounts Matrix Breakdown</CardTitle>
        <CardDescription>
          Each cell prices one (tenderer, contract, DoP) at the DoP
          percentage. Cyan marks the DoP used by the best configuration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-medium dark:bg-gray-900">
                  Tenderer
                </th>
                <th className="w-16 px-2 py-2 text-center font-medium">DoP</th>
                {Array.from({ length: view.contracts }).map((_, c) => (
                  <th
                    key={c}
                    className={`min-w-24 px-2 py-2 text-left font-medium ${!isSelectedIn(view, c) ? "opacity-50" : ""}`}
                  >
                    {view.contractNames[c] || `C${c + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: view.tenderers }).map((_, t) =>
                Array.from({ length: tierCount }).map((_, dopIndex) => (
                  <tr key={`${t}-${dopIndex}`} className="border-b last:border-0">
                    {dopIndex === 0 && (
                      <td
                        className="sticky left-0 z-10 bg-white px-2 py-1.5 font-medium dark:bg-gray-900"
                        rowSpan={tierCount}
                      >
                        {view.tendererNames[t] || `T${t + 1}`}
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-center font-medium">{dopIndex + 1}</td>
                    {Array.from({ length: view.contracts }).map((_, c) => {
                      const resultColumn = resultColumnFor(view, c);
                      const base = resultColumn >= 0 ? view.results.prices?.[t]?.[resultColumn] || 0 : 0;
                      const isBlocked = view.forbidden[t]?.[c] === true;
                      const dop =
                        resultColumn >= 0 && view.results.bestCombo?.assignment?.[resultColumn] === t &&
                        view.results.bestCombo?.tendererCounts
                          ? view.results.bestCombo.tendererCounts[t] - 1
                          : -1;

                      if (isBlocked) {
                        return (
                          <td key={c} className={`px-2 py-2 text-center text-red-600 dark:text-red-400 ${!isSelectedIn(view, c) ? "opacity-50" : ""}`}>
                            <div className="rounded bg-red-500/15 px-2 py-2 text-xs font-medium">
                              <Ban className="mx-auto mb-1 h-3.5 w-3.5" />
                              Blocked
                            </div>
                          </td>
                        );
                      }

                      if (base === 0 || !isSelectedIn(view, c)) {
                        return (
                          <td
                            key={c}
                            className={`px-2 py-2 text-center ${!isSelectedIn(view, c) ? "opacity-50" : ""}`}
                          >
                            –
                          </td>
                        );
                      }

                      const pct = resultColumn >= 0 ? view.results.discounts?.[t]?.[resultColumn]?.[dopIndex] || 0 : 0;
                      const amount = Number((base * (1 - pct / 100)).toFixed(2));
                      const isSelected = dopIndex === dop;
                      const exceedsLowest = amount > lbp[c];

                      return (
                        <td
                          key={c}
                          className={`px-2 py-2 text-center ${!isSelectedIn(view, c) ? "opacity-50" : ""}`}
                        >
                          <div
                            className={`rounded px-2 py-1 text-xs leading-tight ${
                              isSelected ? "bg-[#00B2CA]/20 font-bold dark:bg-[#00B2CA]/30" : ""
                            } ${exceedsLowest ? "bg-gray-200 dark:bg-gray-700" : ""}`}
                          >
                            <div className="font-medium">
                              {view.format(amount, view.showAbbreviated)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              ({pct.toFixed(2)}%)
                            </div>
                            {varianceIndicator(
                              amount,
                              lbp[c],
                              view.format,
                              view.showAbbreviated
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Best combination ---------------- */

export function BestComboCard({ view }: { view: ResultsView }) {
  const lbp = useMemo(() => lowestBasePrices(view), [view]);
  const best = view.results.bestCombo;
  if (!best) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Best Combination Award Breakdown</CardTitle>
        <CardDescription>
          How the cheapest valid configuration awards each contract, with
          variance against the lowest base price.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-medium dark:bg-gray-900">
                  Tenderer
                </th>
                {Array.from({ length: view.contracts }).map((_, c) => (
                  <th
                    key={c}
                    className={`min-w-24 px-2 py-2 text-left font-medium ${!isSelectedIn(view, c) ? "opacity-50" : ""}`}
                  >
                    {view.contractNames[c] || `C${c + 1}`}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: view.tenderers }).map((_, t) => {
                const tendererCosts = Array(view.contracts).fill(0) as number[];
                Array.from({ length: view.contracts }).forEach((_, c) => {
                  const resultColumn = resultColumnFor(view, c);
                  if (resultColumn >= 0 && best.assignment[resultColumn] === t) {
                    tendererCosts[c] = best.contractCosts[resultColumn] || 0;
                  }
                });
                const tendererTotal = tendererCosts.reduce(
                  (sum, cost, c) => (isSelectedIn(view, c) ? sum + (cost || 0) : sum),
                  0
                );
                return (
                  <tr key={t} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5 font-medium dark:bg-gray-900">
                      {view.tendererNames[t] || `T${t + 1}`}
                    </td>
                    {Array.from({ length: view.contracts }).map((_, c) => {
                      const cost = tendererCosts[c];
                      const resultColumn = resultColumnFor(view, c);
                      return (
                        <td
                          key={c}
                          className={`${resultColumn >= 0 && best.assignment[resultColumn] === t ? "bg-[#00B2CA]/20 dark:bg-[#00B2CA]/30" : ""} ${!isSelectedIn(view, c) ? "opacity-50" : ""} px-2 py-1.5`}
                        >
                          {cost > 0 ? (
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {view.format(cost, view.showAbbreviated)}
                              </span>
                              {varianceIndicator(
                                cost,
                                lbp[c],
                                view.format,
                                view.showAbbreviated
                              )}
                            </div>
                          ) : (
                            "–"
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right font-bold">
                      {tendererTotal > 0
                        ? view.format(tendererTotal, view.showAbbreviated)
                        : "–"}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t bg-gray-50 font-bold dark:bg-gray-800">
                <td className="sticky left-0 z-10 bg-gray-50 px-2 py-1.5 dark:bg-gray-800">
                  Total
                </td>
                {Array.from({ length: view.contracts }).map((_, c) => (
                  <td
                    key={c}
                    className={`px-2 py-1.5 ${!isSelectedIn(view, c) ? "opacity-50" : ""}`}
                  >
                    {view.format(
                      best.contractCosts[resultColumnFor(view, c)] || 0,
                      view.showAbbreviated
                    )}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right">
                  {view.format(best.total, view.showAbbreviated)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Niche optimizations ---------------- */

export function NicheCard({ view }: { view: ResultsView }) {
  const niche = view.results.nicheCombos;
  if (niche.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Niche Optimizations
        </CardTitle>
        <CardDescription>
          Configurations where one tenderer wins every contract it bid on
          (a bid on no more than half the scenario). {niche.length} found.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {niche.map((combo, i) => (
          <div key={i} className="rounded-lg border bg-amber-500/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Badge className="bg-amber-500 text-white hover:bg-amber-600">Niche</Badge>
              <span className="font-bold">
                {view.format(combo.total, view.showAbbreviated)}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {Array.from({ length: view.contracts }).map((_, c) => {
                const resultColumn = resultColumnFor(view, c);
                const t = resultColumn >= 0 ? combo.assignment[resultColumn] : -1;
                return (
                  <span key={c} className={!isSelectedIn(view, c) ? "opacity-50" : ""}>
                    {view.contractNames[c] || `C${c + 1}`}:{" "}
                    {t >= 0 ? (
                      <>
                        {view.tendererNames[t] || `T${t + 1}`} ·{" "}
                        <span className="font-medium">
                          {view.format(
                            resultColumn >= 0 ? combo.contractCosts[resultColumn] || 0 : 0,
                            view.showAbbreviated
                          )}
                        </span>
                      </>
                    ) : (
                      "unassigned"
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- What-if ---------------- */

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
              onChange={(e) => updateChange(index, { t: Number(e.target.value) })}
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
              {Array.from({ length: view.contracts }).map((_, c) => (
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
              {Array.from({ length: view.contracts }).map((_, d) => (
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

/* ---------------- Comparison ---------------- */

export function CompareCard({
  view,
  comparison,
  onClear,
}: {
  view: ResultsView;
  comparison: Results | null;
  onClear: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (comparison) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [comparison]);

  if (!comparison) return null;
  const { format, showAbbreviated } = view;
  const rows: { label: string; current: number; baseline: number; goodWhenLower: boolean }[] = [
    { label: "Total lowest base", current: view.results.totalLowestBase, baseline: comparison.totalLowestBase, goodWhenLower: true },
    { label: "Best total", current: view.results.totalSelectedDiscounted, baseline: comparison.totalSelectedDiscounted, goodWhenLower: true },
    { label: "Cost saving", current: view.results.costSaving, baseline: comparison.costSaving, goodWhenLower: false },
    { label: "Valid combinations", current: view.results.totalCombos, baseline: comparison.totalCombos, goodWhenLower: false },
  ];

  return (
    <div ref={cardRef}>
      <Card className="border-violet-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5" />
              Comparison
            </CardTitle>
            <CardDescription>
              Current results against the saved baseline.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear baseline
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Metric</th>
                <th className="px-3 py-2 text-right font-medium">Baseline</th>
                <th className="px-3 py-2 text-right font-medium">Current</th>
                <th className="px-3 py-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diff = Number((row.current - row.baseline).toFixed(2));
                const good = row.goodWhenLower ? diff < 0 : diff > 0;
                return (
                  <tr key={row.label} className="border-b last:border-0 hover:bg-muted/25">
                    <td className="px-3 py-2.5">{row.label}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{format(row.baseline, showAbbreviated)}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {format(row.current, showAbbreviated)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-medium tabular-nums ${
                        diff === 0 ? "text-muted-foreground" : good ? "text-emerald-500" : "text-red-500"
                      }`}
                    >
                      {diff > 0 ? "+" : ""}
                      {row.current === row.baseline ? "" : format(Math.abs(diff), showAbbreviated)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Win analytics ---------------- */

export function AnalyticsCard({ view }: { view: ResultsView }) {
  const stats = useMemo(
    () => computeWinStats(view.results, view.tenderers),
    [view.results, view.tenderers]
  );
  const maxRate = Math.max(1e-9, ...stats.map((s) => s.winRate));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Win Analytics</CardTitle>
        <CardDescription>
          Participation across the {view.results.totalCombos.toLocaleString()}{" "}
          enumerated valid configurations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.map((s) => (
          <div key={s.tenderer} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">
                {view.tendererNames[s.tenderer] || `T${s.tenderer + 1}`}
              </span>
              <span className="text-xs text-muted-foreground">
                {(s.winRate * 100).toFixed(1)}% of combos · {s.totalWins.toLocaleString()}{" "}
                wins · tops the field {s.timesTop.toLocaleString()}×
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div
                className="h-2 rounded bg-[#00B2CA]"
                style={{ width: `${(s.winRate / maxRate) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- Combo explorer ---------------- */

export function ComboExplorerCard({
  view,
  displayedCombinations,
  onLoadMore,
}: {
  view: ResultsView;
  displayedCombinations: number;
  onLoadMore: () => void;
}) {
  const { results } = view;
  if (results.combinations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Matrix Explorer</CardTitle>
        <CardDescription>
          Review the enumerated baseline scenarios, cheapest first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="w-12 px-2 py-2 text-center font-medium">#</th>
                <th className="min-w-36 px-2 py-2 text-left font-medium">Profile</th>
                {Array.from({ length: view.contracts }).map((_, c) => (
                  <th
                    key={c}
                    className={`min-w-24 px-2 py-2 text-left font-medium ${!isSelectedIn(view, c) ? "opacity-50" : ""}`}
                  >
                    {view.contractNames[c] || `C${c + 1}`}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-bold">Grand Total</th>
                <th className="px-2 py-2 text-right font-bold text-emerald-500">
                  Net Savings
                </th>
              </tr>
            </thead>
            <tbody>
              {results.combinations.slice(0, displayedCombinations).map((combo, index) => {
                if (!combo) return null;
                const isBest = combo.isGlobalBest ?? index === 0;
                const savings = Number((results.totalLowestBase - combo.total).toFixed(2));
                return (
                  <tr
                    key={index}
                    className={`border-b transition-colors last:border-0 ${
                      isBest
                        ? "bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-500/20"
                        : ""
                    }`}
                  >
                    <td className="px-2 py-1.5 text-center font-medium">{index + 1}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {isBest ? (
                          <Badge className="flex items-center gap-1 bg-emerald-500 px-1 py-0 text-[10px] text-white">
                            <Award className="h-3 w-3" /> Global Best
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="px-1 py-0 text-[10px] text-muted-foreground">
                            Split Variant
                          </Badge>
                        )}
                        {combo.isNicheOptimization && (
                          <Badge className="bg-amber-500 px-1 py-0 text-[10px] text-white hover:bg-amber-600">
                            Niche
                          </Badge>
                        )}
                      </div>
                    </td>
                    {Array.from({ length: view.contracts }).map((_, c) => {
                      const resultColumn = resultColumnFor(view, c);
                      const tendererIdx = resultColumn >= 0 ? combo.assignment[resultColumn] : -1;
                      const cost = resultColumn >= 0 ? combo.contractCosts[resultColumn] || 0 : 0;
                      return (
                        <td
                          key={c}
                          className={`px-2 py-1.5 ${!isSelectedIn(view, c) ? "opacity-50" : ""}`}
                        >
                          {tendererIdx >= 0 ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-foreground">
                                {view.format(cost, view.showAbbreviated)}
                              </span>
                              <span className="text-[10px] font-medium text-muted-foreground">
                                By: {view.tendererNames[tendererIdx] || `T${tendererIdx + 1}`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right font-bold">
                      {view.format(combo.total, view.showAbbreviated)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-emerald-500">
                      {savings > 0
                        ? `+${view.format(savings, view.showAbbreviated)}`
                        : view.format(0, view.showAbbreviated)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {results.combinations.length > displayedCombinations && (
          <div className="mt-4 flex justify-center">
            <Button onClick={onLoadMore} variant="outline">
              Load More (
              {results.combinations.length - displayedCombinations} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- Data quality hints ---------------- */

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

/* ---------------- Composition ---------------- */

export interface ResultsSectionProps {
  view: ResultsView;
  displayedCombinations: number;
  onLoadMore: () => void;
  onToggleAbbreviated: (b: boolean) => void;
  comparison: Results | null;
  onSnapshot: () => void;
  onClearComparison: () => void;
  whatIf: WhatIf | null;
  setWhatIf: (w: WhatIf | null) => void;
  onComputeWhatIf: () => void;
  isCalculating: boolean;
}

export function ResultsSection({
  view,
  displayedCombinations,
  onLoadMore,
  onToggleAbbreviated,
  comparison,
  onSnapshot,
  onClearComparison,
  whatIf,
  setWhatIf,
  onComputeWhatIf,
  isCalculating,
}: ResultsSectionProps) {
  return (
    <div id="results-section" className="mt-8 space-y-6">
      <DataQualityHints view={view} />
      <SummaryCard
        view={view}
        onToggleAbbreviated={onToggleAbbreviated}
        onSnapshot={onSnapshot}
        hasBaseline={comparison !== null}
      />
      <BasePricesReferenceCard view={view} />
      <DiscountMatrixCard view={view} />
      <BestComboCard view={view} />
      <ComboExplorerCard
        view={view}
        displayedCombinations={displayedCombinations}
        onLoadMore={onLoadMore}
      />
      <NicheCard view={view} />
      <WhatIfCard
        view={view}
        whatIf={whatIf}
        setWhatIf={setWhatIf}
        onCompute={onComputeWhatIf}
        isCalculating={isCalculating}
      />
      <CompareCard view={view} comparison={comparison} onClear={onClearComparison} />
    </div>
  );
}
