"use client";

import { useEffect, useRef, Card, CardContent, CardDescription, CardHeader, CardTitle, Button, GitCompareArrows } from "./shared";
import type { Results, ResultsView } from "./shared";

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

