import type { Results } from "./domain/alliance-combinations";

export interface Snapshot {
  contracts: number;
  tenderers: number;
  prices: number[][];
  discounts: number[][][];
  tendererNames: string[];
  contractNames: string[];
  selectedContracts: number[];
  useAverageDOP: boolean;
  fastMode: boolean;
  forced?: (number | null)[];
  forbidden?: boolean[][];
  maxWins?: number[];
}

export interface HistoryItem {
  id: string;
  savedAt: number;
  name: string;
  source: "manual" | "random";
  snapshot: Snapshot;
}

export interface WhatIfChange {
  t: number;
  c: number;
  tier: number;
  deltaPct: number;
}

export interface WhatIf {
  changes: WhatIfChange[];
  applied?: boolean;
}

export type Draft = Snapshot;

export interface ResultsView {
  results: Results;
  tenderers: number;
  contracts: number;
  tendererNames: string[];
  contractNames: string[];
  selectedContracts: number[];
  forced: (number | null)[];
  forbidden: boolean[][];
  showAbbreviated: boolean;
  fastMode: boolean;
  useAverageDOP: boolean;
  format: (value: number, abbreviated?: boolean) => string;
}
