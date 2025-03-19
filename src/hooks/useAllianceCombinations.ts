import { useState, useEffect } from "react";

// Define types for results and combinations
interface Combination {
  assignment: number[];
  contractCosts: number[];
  total: number;
  tendererCounts: number[];
}

interface Results {
  totalLowestBase: number;
  totalSelectedDiscounted: number;
  costSaving: number;
  combinations: Combination[];
  bestCombo: Combination | null;
  totalCombos: number;
  totalPossibleCombos: number;
  prices: number[][];
  discounts: number[][][];
  dopDifferences?: boolean[][];
}

export const useAllianceCombinations = () => {
  const [contracts, setContracts] = useState(2);
  const [tenderers, setTenderers] = useState(2);
  const [threshold, setThreshold] = useState(5000);
  const [useAverageDOP, setUseAverageDOP] = useState(false);
  const [prices, setPrices] = useState<number[][]>([]);
  const [discounts, setDiscounts] = useState<number[][][]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "random">("manual");
  const [priceMin, setPriceMin] = useState(450000);
  const [priceMax, setPriceMax] = useState(500000);
  const [discountMax, setDiscountMax] = useState(20);
  const [displayedCombinations, setDisplayedCombinations] = useState(50);

  const initializePricesAndDiscounts = () => {
    const newPrices = Array(tenderers)
      .fill(0)
      .map(() => Array(contracts).fill(0));
    const newDiscounts = Array(tenderers)
      .fill(0)
      .map(() => Array(contracts).fill(0).map(() => Array(contracts).fill(0)));

    setPrices(newPrices);
    setDiscounts(newDiscounts);
    setResults(null);
    setShowDiscounts(false);
    setDisplayedCombinations(50);
  };

  useEffect(() => {
    initializePricesAndDiscounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderers, contracts]);

  const handlePriceChange = (t: number, c: number, value: string) => {
    const newPrices = [...prices];
    newPrices[t][c] = Number(Number.parseFloat(value).toFixed(2)) || 0;
    setPrices(newPrices);
  };

  const handleDiscountChange = (
    t: number,
    c: number,
    dop: number,
    value: string
  ) => {
    const newDiscounts = [...discounts];
    newDiscounts[t][c][dop] = Number(Number.parseFloat(value).toFixed(2)) || 0;
    setDiscounts(newDiscounts);
  };

  const generateRandomData = (
    contracts: number,
    tenderers: number,
    priceMin: number,
    priceMax: number,
    discountMax: number
  ) => {
    const prices: number[][] = [];
    const discounts: number[][][] = [];

    for (let i = 0; i < tenderers; i++) {
      prices[i] = [];
      discounts[i] = [];
      for (let j = 0; j < contracts; j++) {
        prices[i][j] =
          Math.floor(Math.random() * (priceMax - priceMin + 1)) + priceMin;
        discounts[i][j] = Array(contracts).fill(0);
        discounts[i][j][0] = 0;
        for (let dop = 1; dop < contracts; dop++) {
          const n = Math.random() * discountMax;
          discounts[i][j][dop] = Number(n.toFixed(4));
        }
      }
    }

    return { prices, discounts };
  };

  const calculateResults = () => {
    try {
      const results = generateResults(
        prices,
        discounts,
        contracts,
        tenderers,
        threshold,
        useAverageDOP
      );
      setResults(results);
      setDisplayedCombinations(50);
    } catch (error) {
      console.error("Error calculating results:", error);
    }
  };

  const calculateRandomResults = () => {
    try {
      const { prices: newPrices, discounts: newDiscounts } = generateRandomData(
        contracts,
        tenderers,
        priceMin,
        priceMax,
        discountMax
      );
      const results = generateResults(
        newPrices,
        newDiscounts,
        contracts,
        tenderers,
        threshold,
        useAverageDOP
      );
      setPrices(newPrices);
      setDiscounts(newDiscounts);
      setResults(results);
      setDisplayedCombinations(50);
    } catch (error) {
      console.error("Error calculating random results:", error);
    }
  };

  const generateResults = (
    prices: number[][],
    discounts: number[][][],
    contracts: number,
    tenderers: number,
    threshold = 5000,
    useAverageDOP = false
  ): Results => {
    const n = contracts;
    const m = tenderers;

    const processedDiscounts = discounts.map((tenderDiscounts) =>
      tenderDiscounts.map((contractDops) => contractDops.slice())
    );
    if (useAverageDOP) {
      for (let t = 0; t < m; t++) {
        const avgDiscounts = Array(n).fill(0);
        for (let dop = 0; dop < n; dop++) {
          const validDops = processedDiscounts[t]
            .map((contractDops) => contractDops[dop])
            .filter((d, c) => prices[t][c] > 0);
          if (validDops.length > 0) {
            const avg =
              validDops.reduce((sum, d) => sum + d, 0) / validDops.length;
            avgDiscounts[dop] = Number(avg.toFixed(2));
          }
        }
        for (let c = 0; c < n; c++) {
          processedDiscounts[t][c] = avgDiscounts.slice();
        }
      }
    }

    const lowestBasePrices = Array(n)
      .fill(0)
      .map((_, j) => {
        const validPrices = prices.map((t) => t[j]).filter((p) => p > 0);
        return validPrices.length > 0
          ? Number(Math.min(...validPrices).toFixed(2))
          : 0;
      });
    const totalLowestBase = Number(
      lowestBasePrices.reduce((a, b) => a + b, 0).toFixed(2)
    );

    const totalPossibleCombos = Math.pow(m, n);

    const validCosts: { dop: number; cost: number }[][][] = Array(m)
      .fill(0)
      .map(() => Array(n).fill(0).map(() => []));

    function calculateContractCost(
      tenderer: number,
      contract: number,
      dop: number
    ) {
      if (prices[tenderer][contract] === 0) return Infinity;
      const discountPercentage = processedDiscounts[tenderer][contract][dop];
      const discount = Number((discountPercentage / 100).toFixed(4));
      const cost = prices[tenderer][contract] * (1 - discount);
      return Number(cost.toFixed(2));
    }

    for (let t = 0; t < m; t++) {
      for (let c = 0; c < n; c++) {
        if (prices[t][c] === 0) continue;
        for (let dop = 0; dop < n; dop++) {
          const cost = calculateContractCost(t, c, dop);
          if (cost !== Infinity && cost <= lowestBasePrices[c]) {
            validCosts[t][c].push({ dop, cost });
          }
        }
        if (
          validCosts[t][c].length === 0 &&
          prices[t][c] > 0 &&
          prices[t][c] <= lowestBasePrices[c]
        ) {
          validCosts[t][c].push({
            dop: 0,
            cost: Number(prices[t][c].toFixed(2)),
          });
        }
      }
    }

    const validContracts = Array(n)
      .fill(false)
      .map((_, c) => validCosts.some((t) => t[c].length > 0));
    const validContractIndices = validContracts
      .map((valid, idx) => (valid ? idx : -1))
      .filter((idx) => idx !== -1);
    const numValidContracts = validContractIndices.length;

    const combinations: Combination[] = [];
    let bestTotal = Infinity;

    if (numValidContracts === 0) {
      return {
        totalLowestBase,
        totalSelectedDiscounted: 0,
        costSaving: totalLowestBase,
        combinations: [],
        bestCombo: null,
        totalCombos: 0,
        totalPossibleCombos,
        prices,
        discounts: processedDiscounts,
      };
    }

    const adjustedTotalPossibleCombos = Math.pow(m, numValidContracts);

    function exhaustiveSearch(
      current: number[] = [],
      tendererCounts: number[] = Array(m).fill(0)
    ) {
      if (current.length === numValidContracts) {
        const fullAssignment = Array(n).fill(-1);
        const contractCosts = Array(n).fill(0);
        validContractIndices.forEach((contractIdx, i) => {
          const tenderer = current[i];
          fullAssignment[contractIdx] = tenderer;
          const validOptions = validCosts[tenderer][contractIdx];
          const dop = tendererCounts[tenderer] - 1;
          const option =
            validOptions.find((o) => o.dop === dop) ||
            validOptions.find((o) => o.dop === 0);
          contractCosts[contractIdx] = option ? option.cost : Infinity;
        });
        const total = Number(
          contractCosts.reduce((a, b) => a + b, 0).toFixed(2)
        );
        if (total !== Infinity) {
          combinations.push({
            assignment: fullAssignment.slice(),
            total,
            contractCosts: contractCosts.map((cost) =>
              Number(cost.toFixed(2))
            ),
            tendererCounts: tendererCounts.slice(),
          });
          bestTotal = Math.min(bestTotal, total);
        }
        return;
      }
      const contractIdx = validContractIndices[current.length];
      for (let t = 0; t < m; t++) {
        if (validCosts[t][contractIdx].length === 0) continue;
        const newCounts = tendererCounts.slice();
        newCounts[t]++;
        exhaustiveSearch([...current, t], newCounts);
      }
    }

    function branchAndBound(
      current: number[] = [],
      tendererCounts: number[] = Array(m).fill(0),
      currentTotal = 0
    ) {
      if (current.length === numValidContracts) {
        const fullAssignment = Array(n).fill(-1);
        const contractCosts = Array(n).fill(0);
        validContractIndices.forEach((contractIdx, i) => {
          const tenderer = current[i];
          fullAssignment[contractIdx] = tenderer;
          const validOptions = validCosts[tenderer][contractIdx];
          const dop = tendererCounts[tenderer] - 1;
          const option =
            validOptions.find((o) => o.dop === dop) ||
            validOptions.find((o) => o.dop === 0);
          contractCosts[contractIdx] = option ? option.cost : Infinity;
        });
        const total = Number(
          contractCosts.reduce((a, b) => a + b, 0).toFixed(2)
        );
        if (total !== Infinity) {
          combinations.push({
            assignment: fullAssignment.slice(),
            total,
            contractCosts: contractCosts.map((cost) =>
              Number(cost.toFixed(2))
            ),
            tendererCounts: tendererCounts.slice(),
          });
          bestTotal = Math.min(bestTotal, total);
        }
        return;
      }

      const contractIdx = validContractIndices[current.length];
      for (let t = 0; t < m; t++) {
        const validOptions = validCosts[t][contractIdx];
        if (validOptions.length === 0) continue;

        const newCounts = tendererCounts.slice();
        newCounts[t]++;
        const dop = newCounts[t] - 1;
        const option =
          validOptions.find((o) => o.dop === dop) ||
          validOptions.find((o) => o.dop === 0);
        const cost = option ? option.cost : Infinity;

        if (cost === Infinity) continue;

        branchAndBound(
          [...current, t],
          newCounts,
          Number((currentTotal + cost).toFixed(2))
        );
      }
    }

    if (adjustedTotalPossibleCombos <= threshold) {
      exhaustiveSearch();
    } else {
      branchAndBound();
    }

    combinations.sort((a, b) => a.total - b.total);

    const bestCombo = combinations[0] || null;
    const totalSelectedDiscounted = bestCombo
      ? bestCombo.total
      : totalLowestBase;
    const costSaving = Number(
      Math.max(0, totalLowestBase - totalSelectedDiscounted).toFixed(2)
    );

    return {
      totalLowestBase,
      totalSelectedDiscounted,
      costSaving,
      combinations,
      bestCombo,
      totalCombos: combinations.length,
      totalPossibleCombos: adjustedTotalPossibleCombos,
      prices,
      discounts: processedDiscounts,
    };
  };

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) {
      return "$0.00";
    }

    try {
      return value.toLocaleString("zh-HK", {
        style: "currency",
        currency: "HKD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch (error) {
      console.error("Error formatting currency:", error, "Value:", value);
      return "$0.00";
    }
  };

  useEffect(() => {
    if (
      !prices.length ||
      prices.length !== tenderers ||
      (prices.length > 0 && prices[0].length !== contracts)
    ) {
      initializePricesAndDiscounts();
    }
  }, [contracts, tenderers, prices, initializePricesAndDiscounts]);

  const safeArrayReduce = (arr: number[] | undefined, initialValue: number) => {
    if (!arr || !Array.isArray(arr)) return initialValue;
    return arr.reduce((sum, val) => sum + (val || 0), initialValue);
  };

  const loadMoreCombinations = () => {
    setDisplayedCombinations((prev) => prev + 50);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as "manual" | "random");
    if (value === "manual") {
      initializePricesAndDiscounts();
    }
  };

  return {
    contracts,
    setContracts,
    tenderers,
    setTenderers,
    threshold,
    setThreshold,
    useAverageDOP,
    setUseAverageDOP,
    prices,
    discounts,
    results,
    showDiscounts,
    setShowDiscounts,
    activeTab,
    handleTabChange,
    priceMin,
    setPriceMin,
    priceMax,
    setPriceMax,
    discountMax,
    setDiscountMax,
    displayedCombinations,
    handlePriceChange,
    handleDiscountChange,
    calculateResults,
    calculateRandomResults,
    formatCurrency,
    safeArrayReduce,
    loadMoreCombinations,
  };
};