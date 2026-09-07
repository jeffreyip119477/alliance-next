/// <reference lib="webworker" />
// Background calculation worker: keeps branch-and-bound search off the main
// thread so large grids stay responsive.

import {
  generateResults,
  type EngineOptions,
  type Results,
} from "../lib/alliance-combinations";

export interface CalcRequest {
  id: number;
  prices: number[][];
  discounts: number[][][];
  cCount: number;
  tCount: number;
  avgDop: boolean;
  options: EngineOptions;
}

export type CalcResponse =
  | { id: number; results: Results; elapsedMs: number }
  | { id: number; error: string };

self.onmessage = (event: MessageEvent<CalcRequest>) => {
  const { id, prices, discounts, cCount, tCount, avgDop, options } = event.data;
  const response: CalcResponse = (() => {
    try {
      const results: Results = generateResults(
        prices,
        discounts,
        cCount,
        tCount,
        avgDop,
        options
      );
      return { id, results, elapsedMs: results.stats.elapsedMs };
    } catch (err) {
      return {
        id,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  })();
  self.postMessage(response);
};
