"use client";

import { useMemo, Card, CardContent, CardDescription, CardHeader, CardTitle, computeWinStats } from "./shared";
import type { ResultsView } from "./shared";

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
          {view.results.combinationsTruncated
            ? "Supplier participation for the exact best award only; the full strategy set was not materialized."
            : `Participation across the ${view.results.totalCombos.toLocaleString()} enumerated valid configurations.`}
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

