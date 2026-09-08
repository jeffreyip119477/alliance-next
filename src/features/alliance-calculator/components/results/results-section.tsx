"use client";

import type { Results } from "../../domain/alliance-combinations";
import type { ResultsView, WhatIf } from "../../types";
import { BasePricesReferenceCard } from "./base-prices-card";
import { BestComboCard } from "./best-combination-card";
import { ComboExplorerCard } from "./combination-explorer-card";
import { DataQualityHints } from "./data-quality-hints";
import { DiscountMatrixCard } from "./discount-matrix-card";
import { NicheCard } from "./niche-card";
import { SummaryCard } from "./summary-card";
import { WhatIfCard } from "./what-if-card";
import { CompareCard } from "./comparison-card";

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
