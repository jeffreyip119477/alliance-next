"use client";

// State + calculation orchestration for the alliance combinations tool.
//
// Design notes:
// - Calculation runs in a Web Worker (workers/calculator.ts) with a
//   request-id race guard; a synchronous fallback exists for SSR/no-worker.
// - The main thread never blocks: large grids stay responsive.
// - Results are always computed for the CURRENT SCENARIO: if the user has
//   selected a subset of contracts, the grid is projected (see
//   domain/projection.ts) so DoP ladders reindex to the selected count k.
// - Draft (grid + settings) autosaves to localStorage so manual input
//   survives refresh. History is saved only on explicit calculate actions.
// - No alert(), no setTimeout(100) load path, no in-place state mutation.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type EngineOptions,
  type Results,
} from "../domain/alliance-combinations";
import { projectToSelectedContracts } from "../domain/projection";
import { cloneShowcaseDataset } from "../domain/showcase-data";
import { formatMoney, parseMoney } from "@/lib/currency";
import type { Draft, HistoryItem, Snapshot, WhatIf } from "../types";
import { allIndices, makeId, scenarioKey } from "../domain/scenario";
import { generateRandomData } from "../domain/random-data";
import {
  readDraft,
  readHistory,
  saveDraft,
  saveHistory,
} from "../infrastructure/persistence";
import { useCalculationWorker } from "./use-calculation-worker";
import { HISTORY_LIMIT } from "../constants";

export type { HistoryItem, Snapshot, WhatIf, WhatIfChange } from "../types";

const DEFAULT_CONTRACTS = 6;
const DEFAULT_TENDERERS = 5;
const CURRENT_DRAFT_VERSION = 2;

const createDefaultTendererNames = (tenderers: number): string[] =>
  Array.from({ length: tenderers }, (_, i) => `Tenderer ${i + 1}`);

const migrateTendererNames = (names: string[], tenderers: number): string[] =>
  names.length === tenderers &&
  names.every((name, i) => name === `Tender ${i + 1}`)
    ? createDefaultTendererNames(tenderers)
    : names;

const createBlankPrices = (tenderers: number, contracts: number): number[][] =>
  Array.from({ length: tenderers }, () => Array(contracts).fill(0));

const createBlankDiscounts = (
  tenderers: number,
  contracts: number
): number[][][] =>
  Array.from({ length: tenderers }, () =>
    Array.from({ length: contracts }, () => Array(contracts).fill(0))
  );

export const useAllianceCombinations = () => {
  // Start with an empty scenario. A saved draft (restored below) still takes
  // priority, and the built-in showcase remains available as an explicit
  // action from the header.

  // --- dimensions & grid ---
  const [contracts, setContracts] = useState(DEFAULT_CONTRACTS);
  const [tenderers, setTenderers] = useState(DEFAULT_TENDERERS);
  const [prices, setPrices] = useState<number[][]>(() =>
    createBlankPrices(DEFAULT_TENDERERS, DEFAULT_CONTRACTS)
  );
  const [discounts, setDiscounts] = useState<number[][][]>(() =>
    createBlankDiscounts(DEFAULT_TENDERERS, DEFAULT_CONTRACTS)
  );
  const [tendererNames, setTendererNames] = useState<string[]>(() =>
    createDefaultTendererNames(DEFAULT_TENDERERS)
  );
  const [contractNames, setContractNames] = useState<string[]>(() =>
    Array.from({ length: DEFAULT_CONTRACTS }, (_, i) => `Contract ${i + 1}`)
  );
  const [selectedContracts, setSelectedContracts] = useState<number[]>([]);

  // --- settings ---
  // A new manual calculation starts with Average-DoP mode enabled.
  const [useAverageDOP, setUseAverageDOP] = useState(true);
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
  const {
    results,
    isCalculating,
    calcError,
    compute,
    reset: resetCalculation,
    lastInputKeyRef,
  } = useCalculationWorker();
  const [hasCalculated, setHasCalculated] = useState(false);
  const [displayedCombinations, setDisplayedCombinations] = useState(50);

  // --- what-if / comparison ---
  const [whatIf, setWhatIf] = useState<WhatIf | null>(null);
  const [comparison, setComparison] = useState<Results | null>(null);

  // --- history ---
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const whatIfBaseKeyRef = useRef<string>("");

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
        : createDefaultTendererNames(tenderers)
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

    const draft = readDraft();
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
      // Drafts created before the default changed did not have a version and
      // stored false automatically, so migrate those to the new default.
      setUseAverageDOP(
        draft.draftVersion === undefined ? true : (draft.useAverageDOP ?? true)
      );
      setFastMode(draft.fastMode ?? false);
      if (Array.isArray(draft.tendererNames) && draft.tendererNames.length === draft.tenderers) {
        setTendererNames(migrateTendererNames(draft.tendererNames, draft.tenderers));
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

    setHistory(readHistory());

  }, []);

  // --- draft autosave (debounced) ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      const draft: Draft = {
        draftVersion: CURRENT_DRAFT_VERSION,
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
      saveDraft(draft);
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
        saveHistory(next);
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
    setUseAverageDOP(true);
    setForced([]);
    setForbidden([]);
    setMaxWins([]);
    resetCalculation();
    setHasCalculated(false);
    setWhatIf(null);
    setComparison(null);
    setDisplayedCombinations(50);
  }, [tenderers, contracts, resetCalculation]);

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
    lastInputKeyRef,
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
      saveHistory(next);
      return next;
    });
  }, []);

  const renameHistoryItem = useCallback((id: string, name: string) => {
    setHistory((prev) => {
      const next = prev.map((h) => (h.id === id ? { ...h, name } : h));
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
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
