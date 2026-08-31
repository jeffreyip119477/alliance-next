"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Info,
  Calculator,
  Settings,
  Database,
  ChevronDown,
  ChevronUp,
  Download,
  Award
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAllianceCombinations } from "../hooks/useAllianceCombinations";
import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import HistorySidebar from "./history-sidebar";

export default memo(function AllianceCombinationsCalculator() {
  const {
    contracts,
    setContracts,
    tenderers,
    setTenderers,
    useAverageDOP,
    setUseAverageDOP,
    prices,
    setPrices,
    discounts,
    setDiscounts,
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
    isLoadingFromHistory,
    setIsLoadingFromHistory,
  } = useAllianceCombinations();

  const [showLegend, setShowLegend] = useState(true);
  const [tendererNames, setTendererNames] = useState<string[]>([]);
  const [selectedContracts, setSelectedContracts] = useState<boolean[]>([]);
  const [shouldSaveToHistory, setShouldSaveToHistory] = useState(false);
  const [showAbbreviatedAmounts, setShowAbbreviatedAmounts] = useState(false);
  const historySidebarRef = useRef<{ refreshHistory: () => void }>(null);

  // Initialize tenderer names and selected contracts when tenderers or contracts change
  useEffect(() => {
    if (!tendererNames.length || tendererNames.length !== tenderers) {
      setTendererNames(
        Array(tenderers)
          .fill("")
          .map((_, i) => `T${i + 1}`)
      );
    }

    if (!selectedContracts.length || selectedContracts.length !== contracts) {
      setSelectedContracts(Array(contracts).fill(true));
    }
  }, [tenderers, contracts, tendererNames.length, selectedContracts.length]);

  // Save to history when results are updated and shouldSaveToHistory is true
  useEffect(() => {
    if (shouldSaveToHistory && results) {
      saveToHistory(results);
      setShouldSaveToHistory(false);
    }
  }, [results, shouldSaveToHistory]);

  const handleTendererNameChange = useCallback((index: number, name: string) => {
    setTendererNames((prev) => {
      const newNames = [...prev];
      newNames[index] = name;
      return newNames;
    });
  }, []);

  const handleContractSelectionChange = useCallback((index: number, selected: boolean) => {
    setSelectedContracts((prev) => {
      const newSelection = [...prev];
      newSelection[index] = selected;
      return newSelection;
    });
  }, []);

  // Save calculation to history
  const saveToHistory = useCallback((currentResults: any) => {
    try {
      const historyItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        contracts,
        tenderers,
        totalLowestBase: currentResults.totalLowestBase,
        totalSelectedDiscounted: currentResults.totalSelectedDiscounted,
        costSaving: currentResults.costSaving,
        tendererNames: [...tendererNames],
        selectedContracts: [...selectedContracts],
        prices: prices.map((row) => [...row]),
        discounts: discounts.map((row) => row.map((col) => [...col])),
      };

      const existingHistory = localStorage.getItem("alliance-calculator-history");
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      history.unshift(historyItem);

      if (history.length > 50) {
        history.splice(50);
      }

      localStorage.setItem("alliance-calculator-history", JSON.stringify(history));

      if (historySidebarRef.current) {
        historySidebarRef.current.refreshHistory();
      }
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  }, [contracts, tenderers, tendererNames, selectedContracts, prices, discounts]);

  const selectedContractCount = useMemo(() => selectedContracts.filter(Boolean).length, [selectedContracts]);

  const lowestBasePrices = useMemo(() => {
    if (!results?.prices) return [];
    return Array(contracts)
      .fill(0)
      .map((_, c) => {
        const validPrices = results.prices
          .map((tender) => tender && tender[c])
          .filter((p) => p && p > 0);
        return validPrices.length > 0 ? Math.min(...validPrices) : 0;
      });
  }, [results?.prices, contracts]);

  const calculateSelectedResults = () => {
    const selectedIndices = selectedContracts
      .map((selected, index) => (selected ? index : -1))
      .filter((index) => index !== -1);

    if (selectedIndices.length === 0) {
      alert("Please select at least one contract");
      return;
    }

    const tempPrices = [...prices];
    const tempDiscounts = [...discounts];

    for (let t = 0; t < tenderers; t++) {
      for (let c = 0; c < contracts; c++) {
        if (!selectedContracts[c]) {
          if (tempPrices[t]) {
            tempPrices[t][c] = 0;
          }
          if (tempDiscounts[t] && tempDiscounts[t][c]) {
            tempDiscounts[t][c] = Array(selectedIndices.length).fill(0);
          }
        } else if (tempDiscounts[t] && tempDiscounts[t][c]) {
          tempDiscounts[t][c] = tempDiscounts[t][c].slice(0, selectedIndices.length);
          while (tempDiscounts[t][c].length < selectedIndices.length) {
            tempDiscounts[t][c].push(0);
          }
        }
      }
    }

    try {
      const originalPrices = [...prices];
      const originalDiscounts = [...discounts];

      prices.splice(0, prices.length, ...tempPrices);
      discounts.splice(0, discounts.length, ...tempDiscounts);

      setShouldSaveToHistory(true);
      calculateResults();

      setTimeout(() => {
        prices.splice(0, prices.length, ...originalPrices);
        discounts.splice(0, discounts.length, ...originalDiscounts);
      }, 100);
    } catch (error) {
      console.error("Error calculating selected results:", error);
    }
  };

  const exportToPDF = async () => {
    if (!results) {
      alert("No results to export. Please calculate results first.");
      return;
    }

    try {
      const resultsElement = document.getElementById("results-section");
      if (!resultsElement) {
        alert("Results section not found. Please try again.");
        return;
      }

      const canvas = await html2canvas(resultsElement, {
        scale: 1,
        useCORS: false,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: resultsElement.clientWidth,
        height: resultsElement.clientHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: resultsElement.clientWidth,
        windowHeight: resultsElement.clientHeight,
        ignoreElements: (element) => {
          return element.tagName === "BUTTON" && (element.textContent?.includes("Load More") ?? false);
        },
      });

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 5;

      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight > pageHeight - 2 * margin) {
        const totalPages = Math.ceil(imgHeight / (pageHeight - 2 * margin));

        for (let page = 0; page < totalPages; page++) {
          if (page > 0) {
            doc.addPage();
          }

          const sourceY = (page * (pageHeight - 2 * margin) * canvas.width) / imgWidth;
          const sourceHeight = Math.min(((pageHeight - 2 * margin) * canvas.width) / imgWidth, canvas.height - sourceY);

          const pageCanvas = document.createElement("canvas");
          const pageCtx = pageCanvas.getContext("2d");
          if (!pageCtx) continue;

          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;

          pageCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
          const pageImgData = pageCanvas.toDataURL("image/png");

          doc.addImage(
            pageImgData,
            "PNG",
            margin,
            margin,
            imgWidth,
            Math.min((sourceHeight * imgWidth) / canvas.width, pageHeight - 2 * margin)
          );
        }
      } else {
        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
      }

      doc.save("alliance_combinations_results.pdf");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    }
  };

  const renderLineVarianceIndicator = (currentCost: number, lowestBasePrice: number) => {
    const variance = lowestBasePrice - currentCost;
    if (variance > 0) {
      return (
        <div className="text-[10px] text-emerald-500 font-bold mt-0.5">
          Save: +{formatCurrency(variance, showAbbreviatedAmounts)}
        </div>
      );
    } else if (variance < 0) {
      return (
        <div className="text-[10px] text-destructive dark:text-red-400 font-medium mt-0.5">
          Add: {formatCurrency(Math.abs(variance), showAbbreviatedAmounts)}
        </div>
      );
    }
    return (
      <div className="text-[10px] text-muted-foreground mt-0.5">
        At Base Minimum
      </div>
    );
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          .fixed.right-0 { display: none !important; }
          main { padding-right: 1rem !important; max-width: none !important; }
          .bg-\[#FF5E93\]\/20 { background-color: rgba(255, 94, 147, 0.2) !important; }
          .bg-\[#00B2CA\]\/20 { background-color: rgba(0, 178, 202, 0.2) !important; }
          .bg-gray-200 { background-color: rgb(229, 231, 235) !important; }
          .bg-\[#00B2CA\]\/10 { background-color: rgba(0, 178, 202, 0.1) !important; }
          .text-\[#00B2CA\] { color: rgb(0, 178, 202) !important; }
          .dark .bg-\[#FF5E93\]\/30 { background-color: rgba(255, 94, 147, 0.3) !important; }
          .dark .bg-\[#00B2CA\]\/30 { background-color: rgba(0, 178, 202, 0.3) !important; }
          .dark .bg-gray-700 { background-color: rgb(55, 65, 81) !important; }
          .dark .bg-\[#00B2CA\]\/20 { background-color: rgba(0, 178, 202, 0.2) !important; }
          .dark .text-\[#00B2CA\] { color: rgb(0, 178, 202) !important; }
          button[aria-label="Close"], .lucide-x, .lucide-chevron-up, .lucide-chevron-down { display: none !important; }
          [role="tablist"], header { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
          table { border-collapse: collapse !important; width: 100% !important; font-size: 10px !important; table-layout: auto !important; }
          th, td { border: 1px solid #e5e7eb !important; padding: 2px 4px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
          .overflow-x-auto { overflow-x: visible !important; transform: scale(1) !important; transform-origin: top left !important; width: 100% !important; margin-bottom: 15px !important; }
          .overflow-x-auto table { font-size: 9px !important; }
          .overflow-x-auto th, .overflow-x-auto td { padding: 2px 3px !important; min-width: 50px !important; max-width: 100px !important; }
          .overflow-x-auto th:first-child, .overflow-x-auto td:first-child { min-width: 80px !important; max-width: 120px !important; }
          .overflow-x-auto th:last-child, .overflow-x-auto td:last-child { min-width: 70px !important; max-width: 120px !important; }
          .sticky.left-0 { position: static !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          @page { margin: 0.5in; size: A4 landscape; }
          .space-y-6 { margin-top: 0.5rem !important; margin-bottom: 0.5rem !important; }
          .space-y-4 { margin-top: 0.25rem !important; margin-bottom: 0.25rem !important; }
          #results-section .space-y-6 > .rounded-lg:first-child .mb-4 { margin-bottom: 0.125rem !important; }
          #results-section .space-y-6 > .rounded-lg:first-child .gap-4 { gap: 0.125rem !important; }
          #results-section .space-y-6 > .rounded-lg:first-child .mt-4 { margin-top: 0.125rem !important; }
          #results-section .space-y-6 > .rounded-lg:first-child .p-4 { padding: 0.125rem !important; }
          #results-section .space-y-6 > .rounded-lg:first-child .p-3 { padding: 0.0625rem !important; }
          #results-section .space-y-6 > .rounded-lg:first-child .pb-2 { padding-bottom: 0.125rem !important; }
          #results-section .space-y-6 > .rounded-lg:first-child > div:last-child > div:not(:last-child) { margin-bottom: 0.125rem !important; }
          #results-section .space-y-6 > .rounded-lg:first-child .text-2xl { font-size: 0.875rem !important; line-height: 1.1 !important; }
          #results-section .space-y-6 > .rounded-lg:first-child .text-sm { font-size: 0.6875rem !important; line-height: 1.1 !important; }
          #results-section .space-y-6 > .rounded-lg:first-child [class*="Alert"] { margin-top: 0.125rem !important; padding: 0.125rem 0.25rem !important; }
          #results-section .space-y-6 > .rounded-lg:first-child .mb-2 { margin-bottom: 0.0625rem !important; }
          #results-section .space-y-6 > .rounded-lg:first-child .gap-2 { gap: 0.0625rem !important; }
          .text-2xl { font-size: 1.25rem !important; }
          .text-xl { font-size: 1.125rem !important; }
          [data-radix-scroll-area-viewport] { overflow: visible !important; }
          .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem !important; }
          .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem !important; }
          #results-section { margin-top: 0 !important; }
          button { display: none !important; }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        <main className="flex-1 container mx-auto py-8 px-4 lg:pr-96">
          <header className="mb-8 flex flex-row items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                Alliance Combinations Calculator
              </h1>
              <p className="text-sm text-muted-foreground">v3.2.2</p>
            </div>
            {results && (
              <Button onClick={exportToPDF} className="flex items-center gap-2 print:hidden" suppressHydrationWarning>
                <Download className="h-4 w-4" /> Export Report
              </Button>
            )}
          </header>
          <Tabs
            defaultValue="manual"
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-8"
          >
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                <span>Manual Input</span>
              </TabsTrigger>
              <TabsTrigger value="random" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Random Generation</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-6">
              <Card className="print:hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configuration
                  </CardTitle>
                  <CardDescription>
                    Set up the parameters for your alliance calculation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="contracts">Contracts</Label>
                      <Badge variant="outline">{contracts}</Badge>
                    </div>
                    <Slider
                      id="contracts"
                      min={1}
                      max={7}
                      step={1}
                      value={[contracts]}
                      onValueChange={(value) => setContracts(value[0])}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1</span>
                      <span>7</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="tenderers">Tenderers</Label>
                      <Badge variant="outline">{tenderers}</Badge>
                    </div>
                    <Slider
                      id="tenderers"
                      min={1}
                      max={20}
                      step={1}
                      value={[tenderers]}
                      onValueChange={(value) => setTenderers(value[0])}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1</span>
                      <span>20</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="averageDOP"
                      checked={useAverageDOP}
                      onCheckedChange={setUseAverageDOP}
                      suppressHydrationWarning
                    />
                    <Label htmlFor="averageDOP">
                      Use Average Discount per DoP Across Contracts
                    </Label>
                  </div>

                  <div className="space-y-2 mt-4">
                    <Label>Contract Selection</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {Array.from({ length: contracts }).map((_, i) => (
                        <div key={i} className="flex items-center space-x-2">
                          <Checkbox
                            id={`contract-${i}`}
                            checked={selectedContracts[i]}
                            onCheckedChange={(checked: boolean) =>
                              handleContractSelectionChange(i, checked)
                            }
                            suppressHydrationWarning
                          />
                          <Label htmlFor={`contract-${i}`}>C{i + 1}</Label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select which contracts to include in the calculation
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="print:hidden">
                <CardHeader>
                  <CardTitle>Tenderer Names</CardTitle>
                  <CardDescription>
                    Customize the names of tenderers for better identification
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {Array.from({ length: tenderers }).map((_, t) => (
                      <div key={t} className="space-y-2">
                        <Label htmlFor={`tenderer-name-${t}`}>T{t + 1}</Label>
                        <Input
                          id={`tenderer-name-${t}`}
                          value={tendererNames[t] || `Tenderer ${t + 1}`}
                          onChange={(e) =>
                            handleTendererNameChange(t, e.target.value)
                          }
                          placeholder={`Tenderer ${t + 1}`}
                          suppressHydrationWarning
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {!showDiscounts ? (
                <Card className="print:hidden">
                  <CardHeader>
                    <CardTitle>Base Prices</CardTitle>
                    <CardDescription>
                      Enter the base price for each tenderer and contract
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <ScrollArea>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="sticky left-0 bg-white dark:bg-gray-800 z-10">
                                Tenderer
                              </TableHead>
                              {Array.from({ length: contracts }).map((_, i) => (
                                <TableHead
                                  key={i}
                                  className={!selectedContracts[i] ? "opacity-50" : ""}
                                >
                                  C{i + 1}
                                </TableHead>
                              ))}
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Array.from({ length: tenderers }).map((_, t) => (
                              <TableRow key={t}>
                                <TableCell className="sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium">
                                  {tendererNames[t] || `T${t + 1}`}
                                </TableCell>
                                {Array.from({ length: contracts }).map((_, c) => (
                                  <TableCell
                                    key={c}
                                    className={!selectedContracts[c] ? "opacity-50" : ""}
                                  >
                                    <Input
                                      type="number"
                                      min={0}
                                      step={1000}
                                      value={prices[t]?.[c] || 0}
                                      onChange={(e) =>
                                        handlePriceChange(t, c, e.target.value)
                                      }
                                      className="w-full"
                                      disabled={!selectedContracts[c]}
                                    />
                                  </TableCell>
                                ))}
                                <TableCell className="font-bold w-64">
                                  {formatCurrency(
                                    prices[t]
                                      ? prices[t]
                                          .filter((_, i) => selectedContracts[i])
                                          .reduce((sum, price) => sum + (price || 0), 0)
                                      : 0,
                                    showAbbreviatedAmounts
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button onClick={() => setShowDiscounts(true)}>
                        Continue to Discounts
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Discount Percentages (%)</CardTitle>
                    <CardDescription>
                      Enter the discount percentage for each degree of preference (DoP)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <ScrollArea>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="sticky left-0 bg-white dark:bg-gray-800 z-10">
                                Tenderer
                              </TableHead>
                              <TableHead className="w-16 text-center">
                                DoP
                              </TableHead>
                              {Array.from({ length: contracts }).map((_, i) => (
                                <TableHead
                                  key={i}
                                  className={!selectedContracts[i] ? "opacity-50" : ""}
                                >
                                  C{i + 1}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Array.from({ length: tenderers }).map((_, t) => {
                              return Array.from({
                                length: selectedContractCount,
                              }).map((_, dopIndex) => (
                                <TableRow key={`${t}-${dopIndex}`}>
                                  {dopIndex === 0 && (
                                    <TableCell
                                      className="sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium"
                                      rowSpan={selectedContractCount}
                                    >
                                      {tendererNames[t] || `T${t + 1}`}
                                    </TableCell>
                                  )}
                                  <TableCell className="font-medium text-center">
                                    {dopIndex + 1}
                                  </TableCell>
                                  {Array.from({ length: contracts }).map((_, c) => (
                                    <TableCell
                                      key={c}
                                      className={`p-2 ${!selectedContracts[c] ? "opacity-50" : ""}`}
                                    >
                                      <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.01}
                                        value={discounts[t]?.[c]?.[dopIndex] || 0}
                                        onChange={(e) =>
                                          handleDiscountChange(t, c, dopIndex, e.target.value)
                                        }
                                        disabled={
                                          !prices[t] ||
                                          prices[t][c] === 0 ||
                                          !selectedContracts[c]
                                        }
                                        className="w-20"
                                      />
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ));
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>

                    <div className="mt-4 flex justify-between">
                      <Button
                        variant="outline"
                        onClick={() => setShowDiscounts(false)}
                      >
                        Back to Prices
                      </Button>
                      <Button onClick={calculateSelectedResults}>
                        Calculate Results
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="random" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Random Data Generation
                  </CardTitle>
                  <CardDescription>
                    Generate random data for testing and simulation purposes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="random-contracts">Contracts</Label>
                          <Badge variant="outline">{contracts}</Badge>
                        </div>
                        <Slider
                          id="random-contracts"
                          min={1}
                          max={7}
                          step={1}
                          value={[contracts]}
                          onValueChange={(value) => setContracts(value[0])}
                          className="py-2"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1</span>
                          <span>7</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="random-tenderers">Tenderers</Label>
                          <Badge variant="outline">{tenderers}</Badge>
                        </div>
                        <Slider
                          id="random-tenderers"
                          min={1}
                          max={20}
                          step={1}
                          value={[tenderers]}
                          onValueChange={(value) => setTenderers(value[0])}
                          className="py-2"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1</span>
                          <span>20</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="price-range">Price Range</Label>
                          <Badge variant="outline">
                            {formatCurrency(priceMin, true)} - {formatCurrency(priceMax, true)}
                          </Badge>
                        </div>
                        <Slider
                          id="price-range"
                          min={1}
                          max={1000000}
                          step={10000}
                          value={[priceMin, priceMax]}
                          onValueChange={(value) => {
                            setPriceMin(Math.min(...value));
                            setPriceMax(Math.max(...value));
                          }}
                          className="py-2"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>$1</span>
                          <span>$1,000,000</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="discount-max">Max Discount %</Label>
                          <Badge variant="outline">{discountMax}%</Badge>
                        </div>
                        <Slider
                          id="discount-max"
                          min={0}
                          max={100}
                          step={1}
                          value={[discountMax]}
                          onValueChange={(value) => setDiscountMax(value[0])}
                          className="py-2"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="random-averageDOP"
                      checked={useAverageDOP}
                      onCheckedChange={setUseAverageDOP}
                      suppressHydrationWarning
                    />
                    <Label htmlFor="random-averageDOP">
                      Use Average Discount per DoP Across Contracts
                    </Label>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={calculateRandomResults}>
                      Generate & Calculate Results
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {results && (
            <div id="results-section" className="mt-8 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold">
                    Results Summary
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="abbreviated-amounts" className="text-sm">
                        Abbreviated
                      </Label>
                      <Switch
                        id="abbreviated-amounts"
                        checked={showAbbreviatedAmounts}
                        onCheckedChange={setShowAbbreviatedAmounts}
                        suppressHydrationWarning
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLegend(!showLegend)}
                      className="h-8 w-8 p-0"
                    >
                      {showLegend ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showLegend && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <h4 className="font-medium mb-2">Legend</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-[#FF5E93]/20 dark:bg-[#FF5E93]/30 mr-2 rounded"></div>
                          <span>Lowest base price for an individual contract</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-[#00B2CA]/20 dark:bg-[#00B2CA]/30 mr-2 rounded"></div>
                          <span>Selected optimal configuration mapping</span>
                        </div>
                        <div className="flex items-center">
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 mr-2 text-[10px] h-4 px-1 py-0">Global Best</Badge>
                          <span>Cheapest cost solution configuration tree</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                      <div className="text-sm text-muted-foreground">Total Lowest Prices</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(results.totalLowestBase, showAbbreviatedAmounts)}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                      <div className="text-sm text-muted-foreground">Total Selected Discounted</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(results.totalSelectedDiscounted, showAbbreviatedAmounts)}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg bg-[#00B2CA]/10 dark:bg-[#00B2CA]/20 shadow-sm">
                      <div className="text-sm text-muted-foreground dark:text-gray-400">Cost Saving</div>
                      <div className="text-2xl font-bold text-[#00B2CA]">
                        {formatCurrency(results.costSaving, showAbbreviatedAmounts)}
                      </div>
                    </div>
                  </div>

                  <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Combinations Strategy Audit Matrix</AlertTitle>
                    <AlertDescription>
                      Identified <strong>{results.totalCombos}</strong> valid configurations meeting contract criteria out of <strong>{results.totalPossibleCombos.toLocaleString()}</strong> scenarios.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {/* Base Prices Reference Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Base Prices Reference</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <ScrollArea>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-white dark:bg-gray-800 z-10">Tenderer</TableHead>
                            {Array.from({ length: contracts }).map((_, i) => (
                              <TableHead key={i} className={!selectedContracts[i] ? "opacity-50" : ""}>
                                C{i + 1}
                              </TableHead>
                            ))}
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from({ length: tenderers }).map((_, t) => {
                            const tenderTotal = results.prices?.[t]
                              ?.filter((_, i) => selectedContracts[i])
                              .reduce((sum, price) => sum + (price || 0), 0) || 0;

                            return (
                              <TableRow key={t}>
                                <TableCell className="sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium">
                                  {tendererNames[t] || `T${t + 1}`}
                                </TableCell>
                                {Array.from({ length: contracts }).map((_, c) => {
                                  const price = results.prices?.[t]?.[c] || 0;
                                  const isLowest = price > 0 && price === lowestBasePrices[c];
                                  return (
                                    <TableCell
                                      key={c}
                                      className={`${isLowest ? "bg-[#FF5E93]/20 dark:bg-[#FF5E93]/30" : ""} ${!selectedContracts[c] ? "opacity-50" : ""}`}
                                    >
                                      {price > 0 ? formatCurrency(price, showAbbreviatedAmounts) : "Declined"}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="font-bold">
                                  {formatCurrency(tenderTotal, showAbbreviatedAmounts)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              {/* Discounts and Amounts Analytical Breakdown Matrix */}
              <Card>
                <CardHeader>
                  <CardTitle>Discounts and Amounts Matrix Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="w-full">
                    <Table className="w-full max-w-full table-auto">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-white dark:bg-gray-800 z-10">
                            Tenderer
                          </TableHead>
                          <TableHead className="w-16 text-center">
                            DoP
                          </TableHead>
                          {Array.from({ length: contracts }).map((_, i) => (
                            <TableHead
                              key={i}
                              className={!selectedContracts[i] ? "opacity-50" : ""}
                            >
                              C{i + 1}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from({ length: tenderers }).map((_, t) => {
                          return Array.from({
                            length: selectedContractCount,
                          }).map((_, dopIndex) => (
                            <TableRow key={`${t}-${dopIndex}`}>
                              {dopIndex === 0 && (
                                <TableCell
                                  className="sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium"
                                  rowSpan={selectedContractCount}
                                >
                                  {tendererNames[t] || `T${t + 1}`}
                                </TableCell>
                              )}
                              <TableCell className="font-medium text-center">
                                {dopIndex + 1}
                              </TableCell>
                              {Array.from({ length: contracts }).map((_, c) => {
                                const base = results.prices?.[t]?.[c] || 0;
                                const dop = results.bestCombo?.assignment?.[c] === t && results.bestCombo?.tendererCounts
                                  ? results.bestCombo.tendererCounts[t] - 1
                                  : -1;

                                if (base === 0 || !selectedContracts[c]) {
                                  return (
                                    <TableCell
                                      key={c}
                                      className={`text-center p-2 ${!selectedContracts[c] ? "opacity-50" : ""}`}
                                    >
                                      -
                                    </TableCell>
                                  );
                                }

                                const discountPercentage = results.discounts?.[t]?.[c]?.[dopIndex] || 0;
                                const amount = Number((base * (1 - discountPercentage / 100)).toFixed(2));
                                const isSelected = dopIndex === dop;
                                const exceedsLowest = amount > lowestBasePrices[c];

                                return (
                                  <TableCell
                                    key={c}
                                    className={`text-center p-2 ${!selectedContracts[c] ? "opacity-50" : ""}`}
                                  >
                                    <div
                                      className={`rounded px-2 py-1 text-xs leading-tight ${
                                        isSelected ? "font-bold bg-[#00B2CA]/20 dark:bg-[#00B2CA]/30" : ""
                                      } ${exceedsLowest ? "bg-gray-200 dark:bg-gray-700" : ""}`}
                                    >
                                      <div className={`font-medium ${!showAbbreviatedAmounts ? "text-xs" : ""}`}>
                                        {formatCurrency(amount, showAbbreviatedAmounts)}
                                      </div>
                                      <div className="text-muted-foreground text-[10px]">
                                        ({discountPercentage.toFixed(2)}%)
                                      </div>
                                      {renderLineVarianceIndicator(amount, lowestBasePrices[c])}
                                    </div>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ));
                        })}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Best Combination Summary Table */}
              {results.bestCombo && (
                <Card>
                  <CardHeader>
                    <CardTitle>Best Combination Award Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <ScrollArea>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="sticky left-0 bg-white dark:bg-gray-800 z-10">Tenderer</TableHead>
                              {Array.from({ length: contracts }).map((_, i) => (
                                <TableHead key={i} className={!selectedContracts[i] ? "opacity-50" : ""}>
                                  C{i + 1}
                                </TableHead>
                              ))}
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Array.from({ length: tenderers }).map((_, t) => {
                              const tendererCosts = Array(contracts).fill(0);
                              if (results.bestCombo?.contractCosts && results.bestCombo?.assignment) {
                                results.bestCombo.contractCosts.forEach((cost, c) => {
                                  if (results.bestCombo?.assignment[c] === t) {
                                    tendererCosts[c] = cost || 0;
                                  }
                                });
                              }
                              const tendererTotal = tendererCosts
                                .filter((_, i) => selectedContracts[i])
                                .reduce((sum, cost) => sum + (cost || 0), 0);

                              return (
                                <TableRow key={t}>
                                  <TableCell className="sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium">
                                    {tendererNames[t] || `T${t + 1}`}
                                  </TableCell>
                                  {Array.from({ length: contracts }).map((_, c) => {
                                    const cost = tendererCosts[c];
                                    return (
                                      <TableCell
                                        key={c}
                                        className={`${results.bestCombo?.assignment?.[c] === t ? "bg-[#00B2CA]/20 dark:bg-[#00B2CA]/30" : ""} ${!selectedContracts[c] ? "opacity-50" : ""}`}
                                      >
                                        {cost > 0 ? (
                                          <div className="flex flex-col">
                                            <span className="font-medium">{formatCurrency(cost, showAbbreviatedAmounts)}</span>
                                            {renderLineVarianceIndicator(cost, lowestBasePrices[c])}
                                          </div>
                                        ) : "-"}
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="font-bold">
                                    {tendererTotal > 0 ? formatCurrency(tendererTotal, showAbbreviatedAmounts) : "-"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow className="bg-gray-50 dark:bg-gray-800 font-bold">
                              <TableCell className="sticky left-0 bg-gray-50 dark:bg-gray-800 z-10">Total</TableCell>
                              {Array.from({ length: contracts }).map((_, c) => {
                                const columnTotal = results.bestCombo?.contractCosts?.[c] || 0;
                                return (
                                  <TableCell key={c} className={!selectedContracts[c] ? "opacity-50" : ""}>
                                    {formatCurrency(columnTotal, showAbbreviatedAmounts)}
                                  </TableCell>
                                );
                              })}
                              <TableCell>{formatCurrency(results.bestCombo.total, showAbbreviatedAmounts)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Comprehensive Combinations Strategy Explorer */}
              {results.combinations && results.combinations.length > 0 && (
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Strategy Matrix Explorer</CardTitle>
                      <CardDescription>
                        Review evaluated baseline scenarios.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <ScrollArea>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 text-center">#</TableHead>
                              <TableHead className="w-48">Strategy Profile</TableHead>
                              {Array.from({ length: contracts }).map((_, i) => (
                                <TableHead key={i} className={!selectedContracts[i] ? "opacity-50" : ""}>
                                  C{i + 1}
                                </TableHead>
                              ))}
                              <TableHead className="font-bold">Grand Total</TableHead>
                              <TableHead className="text-emerald-500 font-bold">Net Savings</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {results.combinations
                              .slice(0, displayedCombinations)
                              .map((combo, index) => {
                                if (!combo) return null;

                                const isBest = index === 0;
                                const savings = Number((results.totalLowestBase - combo.total).toFixed(2));

                                const rowClass = isBest 
                                  ? "bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-500/20" 
                                  : "";

                                return (
                                  <TableRow
                                    key={index}
                                    className={`px-0 transition-colors ${rowClass}`}
                                  >
                                    <TableCell className="font-medium text-center">{index + 1}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1 items-center">
                                        {isBest ? (
                                          <Badge className="bg-emerald-500 text-white flex items-center gap-1 text-[10px] py-0 px-1">
                                            <Award className="h-3 w-3" /> Global Best
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-[10px] py-0 px-1 text-muted-foreground">
                                            Split Variant
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    {Array.from({ length: contracts }).map((_, c) => {
                                      const tendererIdx = combo.assignment?.[c];
                                      const cost = combo.contractCosts?.[c] || 0;
                                      return (
                                        <TableCell key={c} className={!selectedContracts[c] ? "opacity-50" : ""}>
                                          {tendererIdx >= 0 ? (
                                            <div className="flex flex-col">
                                              <span className="font-semibold text-xs text-foreground">
                                                {formatCurrency(cost, showAbbreviatedAmounts)}
                                              </span>
                                              <span className="text-[10px] text-muted-foreground font-medium">
                                                By: {tendererNames[tendererIdx] || `T${tendererIdx + 1}`}
                                              </span>
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground text-xs">-</span>
                                          )}
                                        </TableCell>
                                      );
                                    })}
                                    <TableCell className="font-bold">
                                      {formatCurrency(combo.total, showAbbreviatedAmounts)}
                                    </TableCell>
                                    <TableCell className="font-bold text-emerald-500">
                                      {savings > 0 ? `+${formatCurrency(savings, showAbbreviatedAmounts)}` : "$0.00"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    </div>
                    {results.combinations.length > displayedCombinations && (
                      <div className="mt-4 flex justify-center print:hidden">
                        <Button onClick={loadMoreCombinations} suppressHydrationWarning>
                          Load More ({results.combinations.length - displayedCombinations} remaining)
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </main>

        <div className="fixed right-0 top-0 h-screen overflow-hidden print:hidden">
          <HistorySidebar
            ref={historySidebarRef}
            onLoadHistory={(item) => {
              setContracts(item.contracts);
              setTenderers(item.tenderers);
              setTimeout(() => {
                setPrices(item.prices.map((row) => [...row]));
                setDiscounts(item.discounts.map((row) => row.map((col) => [...col])));
                setTendererNames([...item.tendererNames]);
                setSelectedContracts([...item.selectedContracts]);
                setIsLoadingFromHistory(true);
              }, 100);
            }}
          />
        </div>
      </div>
    </>
  );
});