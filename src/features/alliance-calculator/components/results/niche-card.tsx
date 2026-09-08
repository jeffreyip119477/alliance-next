"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Trophy, isSelectedIn, resultColumnFor } from "./shared";
import type { ResultsView } from "./shared";

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

