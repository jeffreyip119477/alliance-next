// Win-rate statistics derived from an alliance Results object.
// Pure and deterministic: reads only results.combinations and
// results.totalCombos, no side effects.

import type { Results } from "./alliance-combinations";

export interface TendererWinStats {
  tenderer: number;
  winsInCombos: number; // combos where this tenderer won >= 1 contract
  winRate: number; // winsInCombos / totalCombos (0 when totalCombos === 0)
  avgWinCount: number; // mean of tendererCounts[t] over the enumerated combos
  totalWins: number; // sum of tendererCounts[t] over the enumerated combos
  timesTop: number; // combos where this tenderer ties the max win count
}

export const computeWinStats: (results: Results, tCount: number) => TendererWinStats[] = (
  results: Results,
  tCount: number
): TendererWinStats[] => {
  const combos = results.combinations;
  const totalCombos = results.totalCombos;
  const comboCount = combos.length;

  const stats: TendererWinStats[] = [];
  for (let t = 0; t < tCount; t++) {
    let winsInCombos = 0;
    let totalWins = 0;
    let timesTop = 0;
    for (const combo of combos) {
      const counts = combo.tendererCounts;
      const count = typeof counts[t] === "number" ? counts[t] : 0;
      totalWins += count;
      if (count > 0) winsInCombos++;
      // Max over all tenderers in this combo (missing entries count as 0).
      let max = 0;
      for (let u = 0; u < tCount; u++) {
        const c = typeof counts[u] === "number" ? counts[u] : 0;
        if (c > max) max = c;
      }
      if (count === max) timesTop++; // ties count for everyone at the max
    }
    stats.push({
      tenderer: t,
      winsInCombos,
      winRate: totalCombos > 0 ? winsInCombos / totalCombos : 0,
      avgWinCount: comboCount > 0 ? totalWins / comboCount : 0,
      totalWins,
      timesTop,
    });
  }
  return stats;
};
