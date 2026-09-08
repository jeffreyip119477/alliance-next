"use client";

// State + calculation orchestration for the alliance combinations tool.
//
// Design notes:
// - Calculation runs in a Web Worker (src/workers/calculator.ts) with a
//   request-id race guard; a synchronous fallback exists for SSR/no-worker.
// - The main thread never blocks: large grids stay responsive.
// - Results are always computed for the CURRENT SCENARIO: if the user has
//   selected a subset of contracts, the grid is projected (see
//   src/lib/projection.ts) so DoP ladders reindex to the selected count k.
// - Draft (grid + settings) autosaves to localStorage so manual input
//   survives refresh. History is saved only on explicit calculate actions.
// - No alert(), no setTimeout(100) load path, no in-place state mutation.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateResults,
  type EngineOptions,
  type Results,
} from "@/lib/alliance-combinations";
import { projectToSelectedContracts } from "@/lib/projection";
import type { CalcRequest, CalcResponse } from "@/workers/calculator";
import {
  formatMoney,
  parseMoney,
} from "@/lib/currency";
import { cloneShowcaseDataset } from "@/lib/showcase-data";

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

interface Draft {
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

const HISTORY_KEY = "alliance-calculator-history";
const DRAFT_KEY = "alliance-calculator-draft";
const HISTORY_LIMIT = 50;
// A worker normally completes the showcase scenario in a few milliseconds.
// This guard prevents a failed worker (which otherwise leaves the UI spinning
// forever) from blocking the user indefinitely on unusually large scenarios.
const WORKER_TIMEOUT_MS = 15000;

const allIndices = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

const readJson = <T,>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — non-fatal.
  }
};

const makeId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** True when a value looks like a well-formed Snapshot (contracts/tenderers + grids). */
const isSnapshot = (s: unknown): s is Snapshot =>
  !!s &&
  typeof (s as Snapshot).contracts === "number" &&
  typeof (s as Snapshot).tenderers === "number" &&
  Array.isArray((s as Snapshot).prices) &&
  Array.isArray((s as Snapshot).discounts);

/**
 * Normalize a raw history entry from localStorage. Accepts the current
 * { id, savedAt, name, source, snapshot } shape as-is, migrates the pre-snapshot
 * legacy shape ({ id, timestamp, contracts, tenderers, ..., prices, discounts })
 * into the new shape, and returns null for anything malformed (so it is dropped
 * rather than crashing the sidebar).
 */
const normalizeHistoryItem = (raw: unknown): HistoryItem | null => {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  if (isSnapshot(item.snapshot)) {
    return {
      id: typeof item.id === "string" ? item.id : makeId("h"),
      savedAt: typeof item.savedAt === "number" ? item.savedAt : Date.now(),
      name: typeof item.name === "string" ? item.name : "Calculation",
      source: item.source === "random" ? "random" : "manual",
      snapshot: item.snapshot,
    };
  }

  // Legacy (pre-snapshot) shape — migrate to the new format.
  if (
    typeof item.contracts === "number" &&
    typeof item.tenderers === "number" &&
    Array.isArray(item.prices) &&
    Array.isArray(item.discounts)
  ) {
    const ts = typeof item.timestamp === "number" ? item.timestamp : Date.now();
    const legacySelection = Array.isArray(item.selectedContracts)
      ? (item.selectedContracts as unknown[])
      : [];
    const selectedContracts: number[] = legacySelection
      .map((v, i) => (v ? i : -1))
      .filter((i) => i >= 0);
    return {
      id: typeof item.id === "string" ? item.id : makeId("h"),
      savedAt: ts,
      name: `Manual · ${new Date(ts).toLocaleString()}`,
      source: "manual",
      snapshot: {
        contracts: item.contracts as number,
        tenderers: item.tenderers as number,
        prices: item.prices as number[][],
        discounts: item.discounts as number[][][],
        tendererNames: Array.isArray(item.tendererNames)
          ? (item.tendererNames as string[])
          : [],
        contractNames: [],
        selectedContracts,
        useAverageDOP: false,
        fastMode: false,
      },
    };
  }

  return null;
};

/**
 * Stable identity of a calculation scenario (projected grid + options).
 * Used to skip redundant auto-recomputes.
 */
const scenarioKey = (
  p: number[][],
  d: number[][][],
  c: number,
  t: number,
  avgDop: boolean,
  fastMode: boolean,
  selection: number[],
  forced: (number | null)[],
  forbidden: boolean[][],
  maxWins: number[]
): string => {
  const effective = selection.length > 0 ? selection : allIndices(c);
  const proj = projectToSelectedContracts(p, d, effective, forced, forbidden);
  return JSON.stringify([
    c,
    t,
    avgDop,
    fastMode,
    proj.prices,
    proj.discounts,
    proj.forced ?? null,
    proj.forbidden ?? null,
    maxWins,
  ]);
};

export const useAllianceCombinations = () => {
  // Start with a complete, deterministic scenario so a fresh install is
  // immediately useful. A saved draft (restored below) still takes priority.
  const [initialShowcase] = useState(cloneShowcaseDataset);

  // --- dimensions & grid ---
  const [contracts, setContracts] = useState(initialShowcase.contracts);
  const [tenderers, setTenderers] = useState(initialShowcase.tenderers);
  const [prices, setPrices] = useState<number[][]>(initialShowcase.prices);
  const [discounts, setDiscounts] = useState<number[][][]>(initialShowcase.discounts);
  const [tendererNames, setTendererNames] = useState<string[]>(initialShowcase.tendererNames);
  const [contractNames, setContractNames] = useState<string[]>(initialShowcase.contractNames);
  const [selectedContracts, setSelectedContracts] = useState<number[]>([]);

  // --- settings ---
  // A new manual calculation starts with Average-DoP mode disabled.
  const [useAverageDOP, setUseAverageDOP] = useState(false);
  const [fastMode, setFastMode] = useState(false);
  const [priceMin, setPriceMin] = useState(450000);
  const [priceMax, setPriceMax] = useState(500000);
  const [discountMax, setDiscountMax] = useState(20);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "random">("manual");

  // --- constraints (P2 UI binds to these; empty = unconstrained) ---
  const [forced, setForced] = useState<(number | null)[]>([]);
  const [forbidden, setForbidden] = useState<boolean[][]>([]);
  const [maxWins, setMaxWins] = useState<number[]>([]);

  // --- results ---
  const [results, setResults] = useState<Results | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [displayedCombinations, setDisplayedCombinations] = useState(50);

  // --- what-if / comparison ---
  const [whatIf, setWhatIf] = useState<WhatIf | null>(null);
  const [comparison, setComparison] = useState<Results | null>(null);

  // --- history ---
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const requestSeq = useRef(0);
  const lastInputKeyRef = useRef<string>("");
  const whatIfBaseKeyRef = useRef<string>("");

  // --- worker lifecycle ---
  useEffect(() => {
    if (typeof Worker === "undefined") return;
    const worker = new Worker(
      new URL("../workers/calculator.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // --- core computation (worker with race guard, sync fallback) ---
  const compute = useCallback(
    (
      p: number[][],
      d: number[][][],
      cCount: number,
      tCount: number,
      avgDop: boolean,
      options: EngineOptions,
      key: string
    ) => {
      const id = ++requestSeq.current;
      lastInputKeyRef.current = key;
      setIsCalculating(true);
      setCalcError(null);

      const worker = workerRef.current;
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const clearTimeoutGuard = () => {
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }
      };

      const settle = (resp: CalcResponse) => {
        if (settled || resp.id !== id || id !== requestSeq.current) return; // stale response — ignore
        settled = true;
        clearTimeoutGuard();
        setIsCalculating(false);
        if ("error" in resp) {
          setCalcError(resp.error);
          setResults(null);
          return;
        }
        setResults(resp.results);
      };

      const runSyncFallback = () => {
        if (settled || id !== requestSeq.current) return;
        settled = true;
        clearTimeoutGuard();
        if (worker && workerRef.current === worker) {
          worker.terminate();
          workerRef.current = null;
        }

        // SSR, worker startup failure, or a timed-out worker: synchronous
        // fallback is identical to the worker calculation and guarantees the
        // UI cannot remain in a permanent loading state.
        try {
          const r = generateResults(p, d, cCount, tCount, avgDop, options);
          setResults(r);
          setCalcError(null);
          setIsCalculating(false);
        } catch (err) {
          setCalcError(err instanceof Error ? err.message : String(err));
          setResults(null);
          setIsCalculating(false);
        }
      };

      if (!worker) {
        runSyncFallback();
        return;
      }

      worker.onmessage = (event: MessageEvent<CalcResponse>) => settle(event.data);
      worker.onerror = () => runSyncFallback();
      worker.onmessageerror = () => runSyncFallback();
      const req: CalcRequest = {
        id,
        prices: p,
        discounts: d,
        cCount,
        tCount,
        avgDop,
        options,
      };
      try {
        worker.postMessage(req);
        timeout = setTimeout(runSyncFallback, WORKER_TIMEOUT_MS);
      } catch {
        runSyncFallback();
      }
    },
    []
  );

  // Compute the current scenario (projected if contracts are selected).
  const computeCurrent = useCallback(
    (
      p: number[][],
      d: number[][][],
      c: number,
      t: number,
      avgDop: boolean,
      fm: boolean,
      selection: number[],
      f: (number | null)[],
      fb: boolean[][],
      mw: number[]
    ) => {
      const effective = selection.length > 0 ? selection : allIndices(c);
      const proj = projectToSelectedContracts(p, d, effective, f, fb);
      const options: EngineOptions = {
        fastMode: fm,
        forced: proj.forced,
        forbidden: proj.forbidden,
        maxWins: mw,
      };
      compute(
        proj.prices,
        proj.discounts,
        proj.cCount,
        t,
        avgDop,
        options,
        scenarioKey(p, d, c, t, avgDop, fm, selection, f, fb, mw)
      );
    },
    [compute]
  );

  // --- grid sizing: preserve overlapping values, regenerate default names ---
  useEffect(() => {
    setPrices((prev) =>
      Array.from({ length: tenderers }, (_, t) =>
        Array.from({ length: contracts }, (_, c) => prev[t]?.[c] ?? 0)
      )
    );
    setDiscounts((prev) =>
      Array.from({ length: tenderers }, (_, t) =>
        Array.from({ length: contracts }, (_, c) =>
          Array.from({ length: contracts }, (_, d) => prev[t]?.[c]?.[d] ?? 0)
        )
      )
    );
    setTendererNames((prev) =>
      prev.length === tenderers
        ? prev
        : Array.from({ length: tenderers }, (_, i) => `Tenderer ${i + 1}`)
    );
    setContractNames((prev) =>
      prev.length === contracts
        ? prev
        : Array.from({ length: contracts }, (_, i) => `Contract ${i + 1}`)
    );
    setSelectedContracts((prev) => prev.filter((i) => i >= 0 && i < contracts));
  }, [contracts, tenderers]);

  // --- mount: restore draft + history ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    const draft = readJson<Draft>(DRAFT_KEY);
    if (
      draft &&
      typeof draft.contracts === "number" &&
      typeof draft.tenderers === "number" &&
      Array.isArray(draft.prices) &&
      draft.prices.length === draft.tenderers &&
      draft.prices.every((row) => Array.isArray(row) && row.length === draft.contracts) &&
      Array.isArray(draft.discounts) &&
      draft.discounts.length === draft.tenderers &&
      draft.discounts.every(
        (row) =>
          Array.isArray(row) &&
          row.length === draft.contracts &&
          row.every((ladder) => Array.isArray(ladder))
      )
    ) {
      setContracts(draft.contracts);
      setTenderers(draft.tenderers);
      setPrices(draft.prices);
      setDiscounts(draft.discounts);
       setUseAverageDOP(draft.useAverageDOP ?? false);
      setFastMode(draft.fastMode ?? false);
      if (Array.isArray(draft.tendererNames) && draft.tendererNames.length === draft.tenderers) {
        setTendererNames(draft.tendererNames);
      }
      if (Array.isArray(draft.contractNames) && draft.contractNames.length === draft.contracts) {
        setContractNames(draft.contractNames);
      }
      if (Array.isArray(draft.selectedContracts)) {
        setSelectedContracts(draft.selectedContracts);
      }
      setForced(draft.forced ?? []);
      setForbidden(draft.forbidden ?? []);
      setMaxWins(draft.maxWins ?? []);
    }

    const h = readJson<unknown[]>(HISTORY_KEY);
    if (Array.isArray(h)) {
      // Migrate/drop legacy entries so the sidebar never sees a missing snapshot.
      const normalized = h
        .map(normalizeHistoryItem)
        .filter((x): x is HistoryItem => x !== null);
      setHistory(normalized.slice(0, HISTORY_LIMIT));
    }

  }, []);

  // --- draft autosave (debounced) ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      const draft: Draft = {
        contracts,
        tenderers,
        prices,
        discounts,
        tendererNames,
        contractNames,
        selectedContracts,
        useAverageDOP,
        fastMode,
        forced,
        forbidden,
        maxWins,
      };
      writeJson(DRAFT_KEY, draft);
    }, 500);
    return () => clearTimeout(timer);
  }, [
    contracts,
    tenderers,
    prices,
    discounts,
    tendererNames,
    contractNames,
    selectedContracts,
    useAverageDOP,
    fastMode,
    forced,
    forbidden,
    maxWins,
  ]);

  // --- explicit actions ---
  const pushHistory = useCallback(
    (snapshot: Snapshot, source: "manual" | "random") => {
      const item: HistoryItem = {
        id: makeId("h"),
        savedAt: Date.now(),
        source,
        name: `${source === "manual" ? "Manual" : "Random"} · ${new Date().toLocaleString()}`,
        snapshot,
      };
      setHistory((prev) => {
        const next = [item, ...prev].slice(0, HISTORY_LIMIT);
        writeJson(HISTORY_KEY, next);
        return next;
      });
    },
    []
  );

  const makeSnapshot = useCallback(
    (p: number[][], d: number[][][]): Snapshot => ({
      contracts,
      tenderers,
      prices: p,
      discounts: d,
      tendererNames,
      contractNames,
      selectedContracts,
      useAverageDOP,
      fastMode,
      forced,
      forbidden,
      maxWins,
    }),
    [contracts, tenderers, tendererNames, contractNames, selectedContracts, useAverageDOP, fastMode, forced, forbidden, maxWins]
  );

  const calculate = useCallback(() => {
    // A normal calculation is based on the live grid; never leave a prior
    // transient what-if badge attached to the new result.
    setWhatIf(null);
    computeCurrent(
      prices,
      discounts,
      contracts,
      tenderers,
      useAverageDOP,
      fastMode,
      selectedContracts,
      forced,
      forbidden,
      maxWins
    );
    pushHistory(makeSnapshot(prices, discounts), "manual");
    setHasCalculated(true);
    setDisplayedCombinations(50);
  }, [
    computeCurrent,
    prices,
    discounts,
    contracts,
    tenderers,
    useAverageDOP,
    fastMode,
    selectedContracts,
    forced,
    forbidden,
    maxWins,
    pushHistory,
    makeSnapshot,
  ]);

  const generateRandomData = useCallback(
    (c: number, t: number, pMin: number, pMax: number, dMax: number) => {
      const randomPrices: number[][] = [];
      const randomDiscounts: number[][][] = [];
      for (let i = 0; i < t; i++) {
        randomPrices[i] = [];
        randomDiscounts[i] = [];
        for (let j = 0; j < c; j++) {
          randomPrices[i][j] =
            Math.floor(Math.random() * (pMax - pMin + 1)) + pMin;
          randomDiscounts[i][j] = Array(c).fill(0);
          for (let dop = 1; dop < c; dop++) {
            randomDiscounts[i][j][dop] = Number((Math.random() * dMax).toFixed(4));
          }
        }
      }
      return { prices: randomPrices, discounts: randomDiscounts };
    },
    []
  );

  const calculateRandom = useCallback(() => {
    setWhatIf(null);
    const { prices: rp, discounts: rd } = generateRandomData(
      contracts,
      tenderers,
      priceMin,
      priceMax,
      discountMax
    );
    setPrices(rp);
    setDiscounts(rd);
    computeCurrent(
      rp,
      rd,
      contracts,
      tenderers,
      useAverageDOP,
      fastMode,
      selectedContracts,
      forced,
      forbidden,
      maxWins
    );
    pushHistory(
      {
        contracts,
        tenderers,
        prices: rp,
        discounts: rd,
        tendererNames,
        contractNames,
        selectedContracts,
         useAverageDOP,
         fastMode,
         forced,
         forbidden,
         maxWins,
       },
      "random"
    );
    setHasCalculated(true);
    setDisplayedCombinations(50);
  }, [
    generateRandomData,
    contracts,
    tenderers,
    priceMin,
    priceMax,
    discountMax,
    useAverageDOP,
    fastMode,
    selectedContracts,
    forced,
    forbidden,
    maxWins,
    computeCurrent,
    pushHistory,
    tendererNames,
    contractNames,
  ]);

  const newCalculation = useCallback(() => {
    setPrices(
      Array.from({ length: tenderers }, () => Array(contracts).fill(0))
    );
    setDiscounts(
      Array.from({ length: tenderers }, () =>
        Array.from({ length: contracts }, () => Array(contracts).fill(0))
      )
    );
    setSelectedContracts([]);
    setForced([]);
    setForbidden([]);
    setMaxWins([]);
    setResults(null);
    setCalcError(null);
    setIsCalculating(false);
    setHasCalculated(false);
    setWhatIf(null);
    setComparison(null);
    setDisplayedCombinations(50);
  }, [tenderers, contracts]);

  /** Restore the built-in showcase and calculate it immediately. */
  const loadShowcaseData = useCallback(() => {
    const showcase = cloneShowcaseDataset();
    setContracts(showcase.contracts);
    setTenderers(showcase.tenderers);
    setPrices(showcase.prices);
    setDiscounts(showcase.discounts);
    setTendererNames(showcase.tendererNames);
    setContractNames(showcase.contractNames);
    setSelectedContracts([]);
    setUseAverageDOP(showcase.useAverageDOP);
    setFastMode(false);
    setForced([]);
    setForbidden([]);
    setMaxWins([]);
    setWhatIf(null);
    setComparison(null);
    setDisplayedCombinations(50);
    computeCurrent(
      showcase.prices,
      showcase.discounts,
      showcase.contracts,
      showcase.tenderers,
      showcase.useAverageDOP,
      false,
      [],
      [],
      [],
      []
    );
    setHasCalculated(true);
  }, [computeCurrent]);

  // --- what-if: nudge one tier's discount on a COPY, compute transiently ---
  const computeWhatIf = useCallback(() => {
    if (!whatIf || whatIf.changes.length === 0) return;
    setWhatIf((current) => current ? { ...current, applied: true } : current);
    const d2 = discounts.map((row) => row.map((ladder) => [...ladder]));
    whatIfBaseKeyRef.current = scenarioKey(
      prices,
      discounts,
      contracts,
      tenderers,
      useAverageDOP,
      fastMode,
      selectedContracts,
      forced,
      forbidden,
      maxWins
    );
    for (const change of whatIf.changes) {
      const ladder = d2[change.t]?.[change.c];
      if (ladder) {
        const base = ladder[change.tier] ?? 0;
        ladder[change.tier] = Number(Math.max(0, Math.min(100, base + change.deltaPct)).toFixed(2));
      }
    }
    const effective =
      selectedContracts.length > 0 ? selectedContracts : allIndices(contracts);
    const proj = projectToSelectedContracts(prices, d2, effective, forced, forbidden);
    compute(
      proj.prices,
      proj.discounts,
      proj.cCount,
      tenderers,
      useAverageDOP,
      {
        fastMode,
        forced: proj.forced,
        forbidden: proj.forbidden,
        maxWins,
      },
      scenarioKey(prices, d2, contracts, tenderers, useAverageDOP, fastMode, selectedContracts, forced, forbidden, maxWins)
    );
  }, [
    whatIf,
    discounts,
    prices,
    selectedContracts,
    contracts,
    tenderers,
    useAverageDOP,
    fastMode,
    forced,
    forbidden,
    maxWins,
    compute,
  ]);

  // --- auto-recompute (debounced, only once the user has calculated) ---
  useEffect(() => {
    if (!hasCalculated) return;
    // An explicit what-if calculation is already in flight/complete; don't
    // let the draft autosave loop immediately re-trigger it and flicker UI.
    if (whatIf?.applied) {
      const currentKey = scenarioKey(
        prices,
        discounts,
        contracts,
        tenderers,
        useAverageDOP,
        fastMode,
        selectedContracts,
        forced,
        forbidden,
        maxWins
      );
      // Editing the live grid/settings invalidates a transient what-if result.
      if (whatIfBaseKeyRef.current && currentKey !== whatIfBaseKeyRef.current) {
        setWhatIf(null);
      }
      return;
    }
    const timer = setTimeout(() => {
      const key = scenarioKey(
        prices,
        discounts,
        contracts,
        tenderers,
        useAverageDOP,
        fastMode,
        selectedContracts,
        forced,
        forbidden,
        maxWins
      );
      if (key === lastInputKeyRef.current) return;
      if (whatIf) {
        computeWhatIf();
      } else {
        computeCurrent(
          prices,
          discounts,
          contracts,
          tenderers,
          useAverageDOP,
          fastMode,
          selectedContracts,
          forced,
          forbidden,
          maxWins
        );
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [
    hasCalculated,
    prices,
    discounts,
    contracts,
    tenderers,
    useAverageDOP,
    fastMode,
    selectedContracts,
    forced,
    forbidden,
    maxWins,
    whatIf,
    computeWhatIf,
    computeCurrent,
  ]);

  // --- grid handlers ---
  const handlePriceChange = useCallback(
    (t: number, c: number, value: string) => {
      const numValue = parseMoney(value);
      setPrices((prev) =>
        prev.map((row, rowIndex) =>
          rowIndex === t
            ? row.map((cell, colIndex) => (colIndex === c ? numValue : cell))
            : row
        )
      );
    },
    []
  );

  const handleDiscountChange = useCallback(
    (t: number, c: number, dop: number, value: string) => {
      const numValue = parseMoney(value);
      setDiscounts((prev) =>
        prev.map((tenderDiscounts, tenderIndex) =>
          tenderIndex === t
            ? tenderDiscounts.map((contractDops, contractIndex) =>
                contractIndex === c
                  ? contractDops.map((dopValue, dopIndex) =>
                      dopIndex === dop ? numValue : dopValue
                    )
                  : contractDops
              )
            : tenderDiscounts
        )
      );
    },
    []
  );

  // --- tab switching (no grid wipe anymore) ---
  const handleTabChange = useCallback((val: string) => {
    setActiveTab(val as "manual" | "random");
  }, []);

  // --- history ---
  const loadHistoryItem = useCallback(
    (id: string) => {
      const item = history.find((h) => h.id === id);
      if (!item) return;
      const s = item.snapshot;
      if (!s || typeof s.contracts !== "number" || typeof s.tenderers !== "number") return;
      setContracts(s.contracts);
      setTenderers(s.tenderers);
      setPrices(s.prices);
      setDiscounts(s.discounts);
      setTendererNames(s.tendererNames);
      setContractNames(s.contractNames);
      setSelectedContracts(s.selectedContracts ?? []);
      setUseAverageDOP(s.useAverageDOP);
       setFastMode(s.fastMode ?? false);
       setForced(s.forced ?? []);
       setForbidden(s.forbidden ?? []);
       setMaxWins(s.maxWins ?? []);
      setWhatIf(null);
      computeCurrent(
        s.prices,
        s.discounts,
        s.contracts,
        s.tenderers,
        s.useAverageDOP,
        s.fastMode ?? false,
        s.selectedContracts ?? [],
         s.forced ?? [],
         s.forbidden ?? [],
         s.maxWins ?? []
      );
      setHasCalculated(true);
    },
    [history, computeCurrent]
  );

  const deleteHistoryItem = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      writeJson(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const renameHistoryItem = useCallback((id: string, name: string) => {
    setHistory((prev) => {
      const next = prev.map((h) => (h.id === id ? { ...h, name } : h));
      writeJson(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    writeJson(HISTORY_KEY, []);
  }, []);

  // Comparison baseline: snapshot the current results for side-by-side view.
  const setComparisonSnapshot = useCallback(() => {
    setComparison(results);
  }, [results]);

  // --- display ---
  const formatCurrency = useCallback(
    (value: number | null | undefined, abbreviated = false) =>
      formatMoney(value, { abbreviated }),
    []
  );

  const loadMoreCombinations = useCallback(
    () => setDisplayedCombinations((prev) => prev + 50),
    []
  );

  return {
    // dimensions & grid
    contracts,
    setContracts,
    tenderers,
    setTenderers,
    prices,
    setPrices,
    discounts,
    setDiscounts,
    tendererNames,
    setTendererNames,
    contractNames,
    setContractNames,
    selectedContracts,
    setSelectedContracts,
    handlePriceChange,
    handleDiscountChange,
    // settings
    useAverageDOP,
    setUseAverageDOP,
    fastMode,
    setFastMode,
    priceMin,
    setPriceMin,
    priceMax,
    setPriceMax,
    discountMax,
    setDiscountMax,
    showDiscounts,
    setShowDiscounts,
    activeTab,
    handleTabChange,
    // constraints
    forced,
    setForced,
    forbidden,
    setForbidden,
    maxWins,
    setMaxWins,
    // results
    results,
    isCalculating,
    calcError,
    hasCalculated,
    displayedCombinations,
    loadMoreCombinations,
    // actions
    calculate,
    calculateRandom,
    loadShowcaseData,
    newCalculation,
    computeWhatIf,
    // what-if / comparison
    whatIf,
    setWhatIf,
    comparison,
    setComparison,
    setComparisonSnapshot,
    // history
    history,
    loadHistoryItem,
    deleteHistoryItem,
    renameHistoryItem,
    clearHistory,
    // formatting
    formatCurrency,
  };
};
