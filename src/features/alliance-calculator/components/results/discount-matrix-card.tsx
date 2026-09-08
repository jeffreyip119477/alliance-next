"use client";

import { useMemo, Card, CardContent, CardDescription, CardHeader, CardTitle, Ban, isSelectedIn, lowestBasePrices, resultColumnFor, varianceIndicator } from "./shared";
import type { ResultsView } from "./shared";

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

