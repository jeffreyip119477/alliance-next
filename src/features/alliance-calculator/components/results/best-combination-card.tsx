"use client";

import { useMemo, Card, CardContent, CardDescription, CardHeader, CardTitle, isSelectedIn, lowestBasePrices, resultColumnFor, varianceIndicator } from "./shared";
import type { ResultsView } from "./shared";

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
