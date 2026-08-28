import { useState, useEffect, useCallback } from "react";
import { generateResults as computeAllianceResults } from "@/lib/alliance-combinations";

// --- Extended Type Definitions ---
interface Combination {
  assignment: number[];
  contractCosts: number[];
  total: number;
  tendererCounts: number[];
  // Metadata tags for the UI to highlight strategic opportunities
  isGlobalBest?: boolean;
  isNicheOptimization?: boolean;
}

interface Results {
  totalLowestBase: number;
  totalSelectedDiscounted: number;
  costSaving: number;
  combinations: Combination[];
  bestCombo: Combination | null;
  nicheCombos: Combination[]; // Explicitly separated out for UI visibility
  totalCombos: number;
  totalPossibleCombos: number;
  prices: number[][];
  discounts: number[][][];
  dopDifferences?: boolean[][];
}

export const useAllianceCombinations = () => {
  // --- State Configuration ---
  const [contracts, setContracts] = useState(2);
  const [tenderers, setTenderers] = useState(2);
  const [useAverageDOP, setUseAverageDOP] = useState(true);
  const [prices, setPrices] = useState<number[][]>([]);
  const [discounts, setDiscounts] = useState<number[][][]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "random">("manual");
  const [priceMin, setPriceMin] = useState(450000);
  const [priceMax, setPriceMax] = useState(500000);
  const [discountMax, setDiscountMax] = useState(20);
  const [displayedCombinations, setDisplayedCombinations] = useState(50);
  const [isLoadingFromHistory, setIsLoadingFromHistory] = useState(false);

  // --- Grid & Dimension Matrix Initialization ---
  const initializePricesAndDiscounts = useCallback(() => {
    const newPrices = Array(tenderers)
      .fill(0)
      .map(() => Array(contracts).fill(0));
    const newDiscounts = Array(tenderers)
      .fill(0)
      .map(() =>
        Array(contracts)
          .fill(0)
          .map(() => Array(contracts).fill(0))
      );

    setPrices(newPrices);
    setDiscounts(newDiscounts);
    setResults(null);
    setShowDiscounts(false);
    setDisplayedCombinations(50);
  }, [tenderers, contracts]);

  useEffect(() => {
    initializePricesAndDiscounts();
  }, [initializePricesAndDiscounts]);

  // --- Handlers for User Inputs ---
  const handlePriceChange = useCallback((t: number, c: number, value: string) => {
    const numValue = Number(Number.parseFloat(value).toFixed(2)) || 0;
    setPrices((prevPrices) =>
      prevPrices.map((row, rowIndex) =>
        rowIndex === t
          ? row.map((cell, colIndex) => (colIndex === c ? numValue : cell))
          : row
      )
    );
  }, []);

  const handleDiscountChange = useCallback(
    (t: number, c: number, dop: number, value: string) => {
      const numValue = Number(Number.parseFloat(value).toFixed(2)) || 0;
      setDiscounts((prevDiscounts) =>
        prevDiscounts.map((tenderDiscounts, tenderIndex) =>
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
    }, []);

  // --- Mock Generation Utility ---
  const generateRandomData = (
    cCount: number,
    tCount: number,
    pMin: number,
    pMax: number,
    dMax: number
  ) => {
    const randomPrices: number[][] = [];
    const randomDiscounts: number[][][] = [];

    for (let i = 0; i < tCount; i++) {
      randomPrices[i] = [];
      randomDiscounts[i] = [];
      for (let j = 0; j < cCount; j++) {
        randomPrices[i][j] = Math.floor(Math.random() * (pMax - pMin + 1)) + pMin;
        randomDiscounts[i][j] = Array(cCount).fill(0);
        for (let dop = 1; dop < cCount; dop++) {
          randomDiscounts[i][j][dop] = Number((Math.random() * dMax).toFixed(4));
        }
      }
    }
    return { prices: randomPrices, discounts: randomDiscounts };
  };

  // --- Core Analytical Calculation Processing Engine ---
  // Pure implementation lives in src/lib/alliance-combinations.ts (unit-tested).
  const generateResults = useCallback(
    (currentPrices: number[][], currentDiscounts: number[][][], cCount: number, tCount: number, avgDop = false): Results =>
      computeAllianceResults(currentPrices, currentDiscounts, cCount, tCount, avgDop), []);

  // --- Operational Trigger Hooks ---
  const calculateResults = () => {
    const calculated = generateResults(prices, discounts, contracts, tenderers, useAverageDOP);
    setResults(calculated);
    setDisplayedCombinations(50);
  };

  const calculateRandomResults = () => {
    const { prices: rPrices, discounts: rDiscounts } = generateRandomData(
      contracts,
      tenderers,
      priceMin,
      priceMax,
      discountMax
    );
    setPrices(rPrices);
    setDiscounts(rDiscounts);
    const calculated = generateResults(rPrices, rDiscounts, contracts, tenderers, useAverageDOP);
    setResults(calculated);
    setDisplayedCombinations(50);
  };

  const formatCurrency = (value: number | undefined | null, abbreviated = false) => {
    if (value === null || value === undefined) return "$0.00";
    if (abbreviated) {
      if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
      if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  useEffect(() => {
    if (isLoadingFromHistory && prices.length > 0 && discounts.length > 0) {
      calculateResults();
      setIsLoadingFromHistory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingFromHistory, prices, discounts]);

  return {
    contracts, setContracts,
    tenderers, setTenderers,
    useAverageDOP, setUseAverageDOP,
    prices, setPrices,
    discounts, setDiscounts,
    results,
    showDiscounts, setShowDiscounts,
    activeTab,
    handleTabChange: (val: string) => {
      setActiveTab(val as "manual" | "random");
      if (val === "manual") initializePricesAndDiscounts();
    },
    priceMin, setPriceMin,
    priceMax, setPriceMax,
    discountMax, setDiscountMax,
    displayedCombinations,
    handlePriceChange,
    handleDiscountChange,
    calculateResults,
    calculateRandomResults,
    formatCurrency,
    safeArrayReduce: (arr: number[] | undefined, initialValue: number) =>
      !arr || !Array.isArray(arr)
        ? initialValue
        : arr.reduce((sum, val) => sum + (val || 0), initialValue),
    loadMoreCombinations: () => setDisplayedCombinations((prev) => prev + 50),
    isLoadingFromHistory, setIsLoadingFromHistory,
  };
};
