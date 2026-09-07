"use client";

import { useMemo, useState } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Info,
  Award,
  Trophy,
  FlaskConical,
  GitCompareArrows,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Results } from "@/lib/alliance-combinations";
import { computeWinStats } from "@/lib/analytics";
import type { WhatIf } from "@/hooks/useAllianceCombinations";

export interface ResultsView {
  results: Results;
  tenderers: number;
  contracts: number;
  tendererNames: string[];
  contractNames: string[];
  selectedContracts: number[];
  showAbbreviated: boolean;
  fastMode: boolean;
  useAverageDOP: boolean;
  format: (value: number, abbreviated?: boolean) => string;
}

const isSelectedIn = (view: ResultsView, c: number) =>
  view.selectedContracts.length === 0 || view.selectedContracts.includes(c);

const lowestBaseFor = (results: Results, c: number): number => {
  const valid = results.prices
    .map((row) => row?.[c])
    .filter((p) => typeof p === "number" && p > 0);
  return valid.length > 0 ? Math.min(...valid) : 0;
};

const lowestBasePrices = (view: ResultsView): number[] =>
  Array.from({ length: view.contracts }, (_, c) => lowestBaseFor(view.results, c));

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
}: {
  view: ResultsView;
  onToggleAbbreviated: (b: boolean) => void;
  onSnapshot: () => void;
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
            variant="ghost"
            size="sm"
            onClick={onSnapshot}
            title="Keep current results as a comparison baseline"
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

        <Alert className="mt-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Search summary</AlertTitle>
          <AlertDescription>
            Identified <strong>{results.totalCombos.toLocaleString()}</strong> valid
            configurations. Search visited{" "}
            <strong>{results.stats.nodesVisited.toLocaleString()}</strong> nodes,
            evaluated <strong>{results.stats.leavesEvaluated.toLocaleString()}</strong>{" "}
            complete assignments, pruned{" "}
            <strong>{results.stats.prunedNodes.toLocaleString()}</strong> nodes in{" "}
            <strong>{results.stats.elapsedMs.toFixed(1)} ms</strong>
            {view.fastMode ? " — fast mode lists optimal ties only" : ""}.
          </AlertDescription>
        </Alert>
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
                const total = row.reduce(
                  (sum, p, c) => (isSelectedIn(view, c) ? sum + (p || 0) : sum),
                  0
                );
                return (
                  <tr key={t} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5 font-medium dark:bg-gray-900">
                      {view.tendererNames[t] || `T${t + 1}`}
                    </td>
                    {Array.from({ length: view.contracts }).map((_, c) => {
                      const price = row[c] || 0;
                      const isLowest = price > 0 && price === lbp[c];
                      return (
                        <td
                          key={c}
                          className={`${isLowest ? "bg-[#FF5E93]/20 dark:bg-[#FF5E93]/30" : ""} ${!isSelectedIn(view, c) ? "opacity-50" : ""} px-2 py-1.5`}
                        >
                          {price > 0
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
    <Card>
      <CardHeader>
        <CardTitle>Discounts and Amounts Matrix Breakdown</CardTitle>
        <CardDescription>
          Each cell prices one (tenderer, contract, DoP tier) at the tier
          percentage. Cyan marks the tier used by the best configuration.
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
                <th className="w-16 px-2 py-2 text-center font-medium">Tier</th>
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
                      const base = view.results.prices?.[t]?.[c] || 0;
                      const dop =
                        view.results.bestCombo?.assignment?.[c] === t &&
                        view.results.bestCombo?.tendererCounts
                          ? view.results.bestCombo.tendererCounts[t] - 1
                          : -1;

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

                      const pct = view.results.discounts?.[t]?.[c]?.[dopIndex] || 0;
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
                best.contractCosts.forEach((cost, c) => {
                  if (best.assignment[c] === t) tendererCosts[c] = cost || 0;
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
                      return (
                        <td
                          key={c}
                          className={`${best.assignment[c] === t ? "bg-[#00B2CA]/20 dark:bg-[#00B2CA]/30" : ""} ${!isSelectedIn(view, c) ? "opacity-50" : ""} px-2 py-1.5`}
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
                    {view.format(best.contractCosts[c] || 0, view.showAbbreviated)}
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
                const t = combo.assignment[c];
                return (
                  <span key={c} className={!isSelectedIn(view, c) ? "opacity-50" : ""}>
                    {view.contractNames[c] || `C${c + 1}`}:{" "}
                    {t >= 0 ? (
                      <>
                        {view.tendererNames[t] || `T${t + 1}`} ·{" "}
                        <span className="font-medium">
                          {view.format(combo.contractCosts[c] || 0, view.showAbbreviated)}
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
    (c) => isSelectedIn(view, c) && (view.results.prices[whatIf?.t ?? 0]?.[c] ?? 0) > 0
  );

  const select =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const update = (patch: Partial<WhatIf>) => {
    const base: WhatIf = whatIf ?? {
      t: 0,
      c: bidableContracts[0] ?? 0,
      tier: 0,
      deltaPct: 0,
    };
    setWhatIf({ ...base, ...patch });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          What-If Scenario
        </CardTitle>
        <CardDescription>
          Nudge one discount tier by a percentage and see how the best
          configuration changes. The live grid is untouched.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {whatIf && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>What-if active</AlertTitle>
            <AlertDescription>
              Results reflect a {whatIf.deltaPct >= 0 ? "+" : ""}
              {whatIf.deltaPct}% adjustment to tier {whatIf.tier + 1} of{" "}
              {view.tendererNames[whatIf.t] || `T${whatIf.t + 1}`} on{" "}
              {view.contractNames[whatIf.c] || `C${whatIf.c + 1}`}.
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Tenderer</span>
            <select
              className={select}
              value={whatIf?.t ?? 0}
              onChange={(e) => update({ t: Number(e.target.value) })}
            >
              {Array.from({ length: view.tenderers }).map((_, t) => (
                <option key={t} value={t}>
                  {view.tendererNames[t] || `T${t + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Contract</span>
            <select
              className={select}
              value={whatIf?.c ?? 0}
              onChange={(e) => update({ c: Number(e.target.value) })}
            >
              {Array.from({ length: view.contracts }).map((_, c) => (
                <option key={c} value={c}>
                  {view.contractNames[c] || `C${c + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Ladder tier</span>
            <select
              className={select}
              value={whatIf?.tier ?? 0}
              onChange={(e) => update({ tier: Number(e.target.value) })}
            >
              {Array.from({ length: view.contracts }).map((_, d) => (
                <option key={d} value={d}>
                  Tier {d + 1}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Delta %</span>
            <input
              type="number"
              min={-100}
              max={100}
              step={0.5}
              className={select}
              value={whatIf?.deltaPct ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                update({ deltaPct: Number.isFinite(v) ? Math.max(-100, Math.min(100, v)) : 0 });
              }}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setWhatIf(null)}
            disabled={!whatIf}
          >
            Reset
          </Button>
          <Button onClick={onCompute} disabled={isCalculating}>
            {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply what-if
          </Button>
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
  if (!comparison) return null;
  const { format, showAbbreviated } = view;
  const rows: { label: string; current: number; baseline: number; goodWhenLower: boolean }[] = [
    { label: "Total lowest base", current: view.results.totalLowestBase, baseline: comparison.totalLowestBase, goodWhenLower: true },
    { label: "Best total", current: view.results.totalSelectedDiscounted, baseline: comparison.totalSelectedDiscounted, goodWhenLower: true },
    { label: "Cost saving", current: view.results.costSaving, baseline: comparison.costSaving, goodWhenLower: false },
    { label: "Valid combinations", current: view.results.totalCombos, baseline: comparison.totalCombos, goodWhenLower: false },
  ];

  return (
    <Card>
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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-2 text-left font-medium">Metric</th>
              <th className="px-2 py-2 text-right font-medium">Baseline</th>
              <th className="px-2 py-2 text-right font-medium">Current</th>
              <th className="px-2 py-2 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const diff = Number((row.current - row.baseline).toFixed(2));
              const good = row.goodWhenLower ? diff < 0 : diff > 0;
              return (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="px-2 py-1.5">{row.label}</td>
                  <td className="px-2 py-1.5 text-right">{format(row.baseline, showAbbreviated)}</td>
                  <td className="px-2 py-1.5 text-right font-medium">
                    {format(row.current, showAbbreviated)}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-medium ${
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
      </CardContent>
    </Card>
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
                      const tendererIdx = combo.assignment[c];
                      const cost = combo.contractCosts[c] || 0;
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
  const issues = useMemo(() => {
    const out: string[] = [];
    const { prices, discounts } = view.results;
    const lbp = Array.from({ length: view.contracts }, (_, c) => lowestBaseFor(view.results, c));

    for (let t = 0; t < view.tenderers; t++) {
      for (let c = 0; c < view.contracts; c++) {
        const ladder = discounts[t]?.[c] ?? [];
        for (let d = 1; d < ladder.length; d++) {
          if (ladder[d] < ladder[d - 1]) {
            out.push(
              `${view.tendererNames[t] || `T${t + 1}`} · ${view.contractNames[c] || `C${c + 1}`}: discount drops at tier ${d + 1} (${ladder[d]}% < ${ladder[d - 1]}%) — deeper wins are priced higher.`
            );
          }
        }
        const price = prices[t]?.[c] || 0;
        if (price > 0 && lbp[c] > 0 && price > lbp[c]) {
          out.push(
            `${view.tendererNames[t] || `T${t + 1}`} cannot win ${view.contractNames[c] || `C${c + 1}`} standalone: ${view.format(price, true)} is above the lowest base ${view.format(lbp[c], true)}.`
          );
        }
      }
    }
    for (let c = 0; c < view.contracts; c++) {
      const selected =
        view.selectedContracts.length === 0 || view.selectedContracts.includes(c);
      if (lbp[c] === 0 && selected) {
        out.push(`${view.contractNames[c] || `C${c + 1}`}: no tenderer bids it — it will never be awarded.`);
      }
    }
    if (view.useAverageDOP) {
      out.push("Average DoP mode: each contract is priced at the tenderer's average discount across the contracts it bids.");
    }
    return out;
  }, [view]);

  if (issues.length === 0) return null;

  return (
    <Alert>
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle>Data quality notes ({issues.length})</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {issues.slice(0, 12).map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
          {issues.length > 12 && <li>…and {issues.length - 12} more.</li>}
        </ul>
      </AlertDescription>
    </Alert>
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
      <SummaryCard view={view} onToggleAbbreviated={onToggleAbbreviated} onSnapshot={onSnapshot} />
      <BasePricesReferenceCard view={view} />
      <DiscountMatrixCard view={view} />
      <BestComboCard view={view} />
      <NicheCard view={view} />
      <WhatIfCard
        view={view}
        whatIf={whatIf}
        setWhatIf={setWhatIf}
        onCompute={onComputeWhatIf}
        isCalculating={isCalculating}
      />
      <CompareCard view={view} comparison={comparison} onClear={onClearComparison} />
      <AnalyticsCard view={view} />
      <ComboExplorerCard
        view={view}
        displayedCombinations={displayedCombinations}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}
