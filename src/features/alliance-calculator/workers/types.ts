import type { EngineOptions, Results } from "../domain/alliance-combinations";

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
