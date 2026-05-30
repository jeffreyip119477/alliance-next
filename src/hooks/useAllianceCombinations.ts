import { useState, useEffect, useCallback } from "react";

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

  const handleDiscountChange = useCallback((
    t: number,
    c: number,
    dop: number,
    value: string
  ) => {
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
  const generateResults = useCallback((
    currentPrices: number[][],
    currentDiscounts: number[][][],
    cCount: number,
    tCount: number,
    avgDop = false
  ): Results => {
    const n = cCount;
    const m = tCount;

    const validPrices =
      Array.isArray(currentPrices) && currentPrices.length === m
        ? currentPrices.map((row) => [...row])
        : Array(m).fill(0).map(() => Array(n).fill(0));

    const validDiscounts =
      Array.isArray(currentDiscounts) && currentDiscounts.length === m
        ? currentDiscounts.map((row) => row.map((dopArr) => [...dopArr]))
        : Array(m).fill(0).map(() =>
            Array(n).fill(0).map(() => Array(n).fill(0))
          );

    if (avgDop) {
      for (let t = 0; t < m; t++) {
        const avgDiscounts = Array(n).fill(0);
        for (let dop = 0; dop < n; dop++) {
          const validDops = validDiscounts[t]
            .map((contractDops) => contractDops[dop])
            .filter((_, c) => validPrices[t][c] > 0);
          if (validDops.length > 0) {
            const avg = validDops.reduce((sum, d) => sum + d, 0) / validDops.length;
            avgDiscounts[dop] = Number(avg.toFixed(2));
          }
        }
        for (let c = 0; c < n; c++) {
          validDiscounts[t][c] = [...avgDiscounts];
        }
      }
    }

    // Determine baseline standalone minimum cost options
    const lowestBasePrices = Array(n)
      .fill(0)
      .map((_, j) => {
        const validRowPrices = validPrices.map((t) => t[j]).filter((p) => p > 0);
        return validRowPrices.length > 0
          ? Number(Math.min(...validRowPrices).toFixed(2))
          : 0;
      });

    const totalLowestBase = Number(
      lowestBasePrices.reduce((a, b) => a + b, 0).toFixed(2)
    );
    const totalPossibleCombos = Math.pow(m, n);

    // Calculate how many total contracts each tenderer submitted bids for (to detect niche packages)
    const tendererTotalBidPoolCounts = Array(m)
      .fill(0)
      .map((_, t) => validPrices[t].filter((p) => p > 0).length);

    const validCosts: { dop: number; cost: number }[][][] = Array(m)
      .fill(0)
      .map(() => Array(n).fill(0).map(() => []));

    for (let t = 0; t < m; t++) {
      for (let c = 0; c < n; c++) {
        if (validPrices[t][c] === 0) continue;
        for (let dop = 0; dop < n; dop++) {
          const discountPercentage = validDiscounts[t][c][dop];
          const cost = Number(
            (validPrices[t][c] * (1 - discountPercentage / 100)).toFixed(2)
          );
          validCosts[t][c].push({ dop, cost });
        }
      }
    }

    const validContractIndices = Array(n)
      .fill(0)
      .map((_, c) => c)
      .filter((c) => validCosts.some((t) => t[c].length > 0));

    const numValidContracts = validContractIndices.length;
    const allValidCombinations: Combination[] = [];

    if (numValidContracts === 0) {
      return {
        totalLowestBase,
        totalSelectedDiscounted: 0,
        costSaving: totalLowestBase,
        combinations: [],
        bestCombo: null,
        nicheCombos: [],
        totalCombos: 0,
        totalPossibleCombos,
        prices: validPrices,
        discounts: validDiscounts,
      };
    }

    // Recursive search tree
    function branchAndBound(
      current: number[] = [],
      tendererCounts: number[] = Array(m).fill(0),
      currentTotal = 0
    ) {
      // Allow exploration up to total raw base ceiling to capture interesting split cases
      if (currentTotal > totalLowestBase) return;

      if (current.length === numValidContracts) {
        const fullAssignment = Array(n).fill(-1);
        const contractCosts = Array(n).fill(0);
        let passesIndividualCeilingRule = true;

        for (let i = 0; i < numValidContracts; i++) {
          const contractIdx = validContractIndices[i];
          const tenderer = current[i];
          
          fullAssignment[contractIdx] = tenderer;
          
          const validOptions = validCosts[tenderer][contractIdx];
          const dop = Math.max(0, tendererCounts[tenderer] - 1);
          
          const option =
            validOptions.find((o) => o.dop === dop) ||
            validOptions.find((o) => o.dop === 0);
            
          const finalCost = option ? option.cost : validPrices[tenderer][contractIdx];
          contractCosts[contractIdx] = finalCost;

          // Standalone ceiling verification
          if (finalCost > lowestBasePrices[contractIdx]) {
            passesIndividualCeilingRule = false;
            break;
          }
        }

        if (passesIndividualCeilingRule) {
          const total = Number(contractCosts.reduce((a, b) => a + b, 0).toFixed(2));
          
          if (total <= totalLowestBase) {
            let isNicheOptimization = false;

            // STRATEGIC ANALYSIS RULE: Check if this combination contains a tenderer
            // who bid on a limited pool of contracts (<= 50% of overall pack) but won ALL of them.
            for (let t = 0; t < m; t++) {
              const totalBidsSubmittedByThem = tendererTotalBidPoolCounts[t];
              const totalContractsAwardedToThemInThisBranch = tendererCounts[t];

              if (
                totalBidsSubmittedByThem > 0 &&
                totalBidsSubmittedByThem <= Math.ceil(n / 2) && 
                totalContractsAwardedToThemInThisBranch === totalBidsSubmittedByThem
              ) {
                isNicheOptimization = true;
                break;
              }
            }

            allValidCombinations.push({
              assignment: fullAssignment,
              total,
              contractCosts,
              tendererCounts: [...tendererCounts],
              isNicheOptimization,
            });
          }
        }
        return;
      }

      const contractIdx = validContractIndices[current.length];
      for (let t = 0; t < m; t++) {
        if (validCosts[t][contractIdx].length === 0) continue;

        const nextCounts = [...tendererCounts];
        nextCounts[t]++;

        const dop = Math.max(0, nextCounts[t] - 1);
        const validOptions = validCosts[t][contractIdx];
        const option =
          validOptions.find((o) => o.dop === dop) ||
          validOptions.find((o) => o.dop === 0);
        const cost = option ? option.cost : validPrices[t][contractIdx];

        branchAndBound(
          [...current, t],
          nextCounts,
          Number((currentTotal + cost).toFixed(2))
        );
      }
    }

    branchAndBound();
    
    // Sort ascending by lowest overall cost
    allValidCombinations.sort((a, b) => a.total - b.total);

    // Tag the absolute top winner
    if (allValidCombinations.length > 0) {
      allValidCombinations[0].isGlobalBest = true;
    }

    const bestCombo = allValidCombinations[0] || null;
    const totalSelectedDiscounted = bestCombo ? bestCombo.total : totalLowestBase;
    const costSaving = Number(Math.max(0, totalLowestBase - totalSelectedDiscounted).toFixed(2));

    // Extract niche specialty combinations explicitly so they can be isolated in rendering
    const nicheCombos = allValidCombinations.filter((c) => c.isNicheOptimization);

    return {
      totalLowestBase,
      totalSelectedDiscounted,
      costSaving,
      combinations: allValidCombinations,
      bestCombo,
      nicheCombos, 
      totalCombos: allValidCombinations.length,
      totalPossibleCombos: Math.pow(m, numValidContracts),
      prices: validPrices,
      discounts: validDiscounts,
    };
  }, []);

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