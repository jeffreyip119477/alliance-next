"use client";

import { useMemo, Card, CardContent, CardDescription, CardHeader, CardTitle, Ban, isSelectedIn, lowestBasePrices, resultColumnFor } from "./shared";
import type { ResultsView } from "./shared";

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

