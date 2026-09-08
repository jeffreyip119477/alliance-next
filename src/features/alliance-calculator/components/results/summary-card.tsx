"use client";

import { useState, Card, CardContent, CardHeader, CardTitle, Button, Badge, Switch, Label, GitCompareArrows, AlertTriangle, ChevronDown, ChevronUp } from "./shared";
import type { ResultsView } from "./shared";

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
  const infeasible = results.status === "infeasible";
  const savingRate = results.totalLowestBase > 0 && !infeasible
    ? (results.costSaving / results.totalLowestBase) * 100
    : 0;

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
              {infeasible ? "—" : format(results.totalSelectedDiscounted, showAbbreviated)}
            </div>
          </div>
          <div className="rounded-lg border bg-[#00B2CA]/10 p-4 shadow-sm dark:bg-[#00B2CA]/20">
            <div className="text-sm text-muted-foreground dark:text-gray-400">Cost Saving</div>
            <div className="text-2xl font-bold text-[#00B2CA]">
              {infeasible
                ? "—"
                : `${format(results.costSaving, showAbbreviated)} (${savingRate.toFixed(1)}% saving)`}
            </div>
          </div>
        </div>
        {infeasible && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>No compliant award was found. No saving is reported until every selected contract can be awarded within the original lowest-base ceiling.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
