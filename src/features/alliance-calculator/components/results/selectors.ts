import type { Results } from "../../domain/alliance-combinations";
import type { ResultsView } from "../../types";

export const isSelectedIn = (view: ResultsView, contractIndex: number) =>
  view.selectedContracts.length === 0 ||
  view.selectedContracts.includes(contractIndex);

export const lowestBaseFor = (results: Results, contractIndex: number): number => {
  const valid = results.prices
    .map((row) => row?.[contractIndex])
    .filter((price) => typeof price === "number" && price > 0);
  return valid.length > 0 ? Math.min(...valid) : 0;
};

// Results for a partial selection use dense projected columns. This maps an
// original contract index to the corresponding result column.
export const resultColumnFor = (
  view: ResultsView,
  contractIndex: number
): number =>
  view.selectedContracts.length > 0
    ? [...view.selectedContracts]
        .sort((a, b) => a - b)
        .indexOf(contractIndex)
    : contractIndex;

export const lowestBasePrices = (view: ResultsView): number[] =>
  Array.from({ length: view.contracts }, (_, contractIndex) => {
    const resultColumn = resultColumnFor(view, contractIndex);
    return resultColumn >= 0
      ? lowestBaseFor(view.results, resultColumn)
      : 0;
  });
