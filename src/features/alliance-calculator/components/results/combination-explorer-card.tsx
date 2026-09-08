"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge, Award, isSelectedIn, resultColumnFor } from "./shared";
import type { ResultsView } from "./shared";

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
          {results.combinationsTruncated
            ? "The grid is large, so this shows the exact best award without materializing every assignment."
            : "Review the enumerated baseline scenarios, cheapest first."}
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

