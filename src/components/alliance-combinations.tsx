"use client";

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calculator,
  Database,
  Settings,
  Download,
  Plus,
  Loader2,
  History as HistoryIcon,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { useAllianceCombinations } from "../hooks/useAllianceCombinations";
import { gridToCsv } from "@/lib/csv";
import { downloadResultsPdf } from "@/lib/pdf";
import { PriceGrid } from "./price-grid";
import { DiscountGrid } from "./discount-grid";
import { ConstraintsPanel } from "./constraints-panel";
import { RandomPanel } from "./random-panel";
import { ResultsSection } from "./results-section";
import HistorySidebar, { MobileHistoryDrawer } from "./history-sidebar";
import { ThemeToggle } from "./theme-toggle";

export default function AllianceCombinationsCalculator() {
  const {
    contracts,
    setContracts,
    tenderers,
    setTenderers,
    prices,
    discounts,
    tendererNames,
    setTendererNames,
    contractNames,
    setContractNames,
    selectedContracts,
    setSelectedContracts,
    handlePriceChange,
    handleDiscountChange,
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
    forced,
    setForced,
    forbidden,
    setForbidden,
    maxWins,
    setMaxWins,
    results,
    isCalculating,
    calcError,
    displayedCombinations,
    loadMoreCombinations,
    calculate,
    calculateRandom,
    loadShowcaseData,
    newCalculation,
    computeWhatIf,
    whatIf,
    setWhatIf,
    comparison,
    setComparison,
    setComparisonSnapshot,
    history,
    loadHistoryItem,
    deleteHistoryItem,
    renameHistoryItem,
    clearHistory,
    formatCurrency,
  } = useAllianceCombinations();

  const [showAbbreviatedAmounts, setShowAbbreviatedAmounts] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const historyProps = {
    history,
    onLoad: loadHistoryItem,
    onDelete: deleteHistoryItem,
    onRename: renameHistoryItem,
    onClear: clearHistory,
  };

  /* ---------- data I/O ---------- */

  const handleCsvExport = () => {
    const csv = gridToCsv({
      contracts,
      tenderers,
      prices,
      discounts,
      tendererNames,
      contractNames,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alliance-grid.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePdfExport = () => {
    if (!results) return;
    const heading = window.prompt(
      "Enter a heading for this report (shown below Alliance Combinations Report):",
      "Alliance decision summary"
    );
    if (heading === null) return;
    downloadResultsPdf(results, {
      reportHeading: heading,
      tendererNames,
      contractNames,
      whatIf: whatIf?.applied ? whatIf : undefined,
    });
  };

  /* ---------- small helpers ---------- */

  const toggleContract = (c: number) =>
    setSelectedContracts((prev) => {
      // An empty selection means “all contracts” internally. When the user
      // unticks one from that default, materialize the remaining contracts.
      const current = prev.length === 0 ? Array.from({ length: contracts }, (_, i) => i) : prev;
      return (current.includes(c) ? current.filter((x) => x !== c) : [...current, c]).sort(
        (a, b) => a - b
      );
    });

  const nameInputs = (
    count: number,
    names: string[],
    setNames: (n: string[]) => void,
    label: string,
    prefix: string
  ) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-1">
          <Label htmlFor={`${prefix}-${i}`} className="text-xs text-muted-foreground">
            {prefix} {i + 1}
          </Label>
          <Input
            id={`${prefix}-${i}`}
            value={names[i] ?? ""}
            placeholder={`${label} ${i + 1}`}
            onChange={(e) =>
              setNames(names.map((n, j) => (j === i ? e.target.value : n)))
            }
            suppressHydrationWarning
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8 lg:pr-96">
        <header className="mb-8 flex flex-row items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Alliance Combinations Calculator</h1>
            <p className="text-sm text-muted-foreground">
              v4.0.0 — worker-backed, offline-friendly
            </p>
          </div>
          <div className="flex items-center gap-2">
            {results && (
              <>
                <Button variant="outline" onClick={handlePdfExport}>
                  <FileText className="h-4 w-4" /> Export PDF
                </Button>
                <Button variant="outline" onClick={handleCsvExport}>
                  <Download className="h-4 w-4" /> Grid CSV
                </Button>
              </>
            )}
            <Button variant="outline" onClick={loadShowcaseData} title="Load and calculate the built-in six-contract showcase">
              <Database className="h-4 w-4" /> Showcase
            </Button>
            <Button variant="outline" onClick={newCalculation}>
              <Plus className="h-4 w-4" /> New
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileHistoryOpen(true)}
              aria-label="Open calculation history"
            >
              <HistoryIcon className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </header>

        {calcError && (
          <Alert className="mb-6 border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <AlertTitle>Calculation failed</AlertTitle>
            <AlertDescription>{calcError}</AlertDescription>
          </Alert>
        )}

        {isCalculating && (
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculating in the background — the page stays responsive.
          </div>
        )}

        <Tabs
          defaultValue="manual"
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-8"
        >
          <TabsList className="mx-auto grid w-full max-w-md grid-cols-2">
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
            <Card>
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
                    max={10}
                    step={1}
                    value={[contracts]}
                    onValueChange={(value) => setContracts(value[0])}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1</span>
                    <span>10</span>
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
                  />
                  <Label htmlFor="averageDOP">
                    Use Average Discount per DoP Across Contracts
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground">
                          (average DoP prices each contract at the tenderer&rsquo;s
                          mean discount across the contracts it bids)
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Average DoP mode prices every contract a tenderer bids at
                        its average discount percentage.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="fastMode" checked={fastMode} onCheckedChange={setFastMode} />
                  <Label htmlFor="fastMode">Fast mode (optimal ties only)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground">
                          (keeps the search under control on big grids)
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Fast mode prunes the search as soon as a configuration
                        can no longer beat the best found so far. The explorer
                        then lists only the tied-optimal configurations;
                        best total and saving are unchanged.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="space-y-2">
                  <Label>Contract Selection</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                    {Array.from({ length: contracts }).map((_, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <Checkbox
                          id={`contract-${i}`}
                          checked={selectedContracts.length === 0 || selectedContracts.includes(i)}
                          onCheckedChange={() => toggleContract(i)}
                          suppressHydrationWarning
                        />
                        <Label htmlFor={`contract-${i}`} className="cursor-pointer">
                          {contractNames[i] || `C${i + 1}`}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All contracts are selected by default. Untick contracts to exclude
                    them from the calculation.
                  </p>
                </div>

              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Names</CardTitle>
                <CardDescription>
                  Give tenderers and contracts meaningful names — they appear in
                  the results, CSV and PDF exports.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tenderers</Label>
                  {nameInputs(tenderers, tendererNames, setTendererNames, "Tenderer", "tenderer-name")}
                </div>
                <div className="space-y-2 border-t pt-4">
                  <Label className="text-sm font-medium">Contracts</Label>
                  {nameInputs(contracts, contractNames, setContractNames, "Contract", "contract-name")}
                </div>
              </CardContent>
            </Card>

            {!showDiscounts ? (
              <PriceGrid
                prices={prices}
                tenderers={tenderers}
                contracts={contracts}
                tendererNames={tendererNames}
                contractNames={contractNames}
                selectedContracts={selectedContracts}
                showAbbreviated={showAbbreviatedAmounts}
                format={formatCurrency}
                onPriceChange={(t, c, v) => handlePriceChange(t, c, String(v))}
                onContinue={() => setShowDiscounts(true)}
              />
            ) : (
              <DiscountGrid
                discounts={discounts}
                prices={prices}
                tenderers={tenderers}
                contracts={contracts}
                tendererNames={tendererNames}
                contractNames={contractNames}
                selectedContracts={selectedContracts}
                onDiscountChange={(t, c, d, v) => handleDiscountChange(t, c, d, String(v))}
                onBack={() => setShowDiscounts(false)}
                onCalculate={calculate}
                isCalculating={isCalculating}
              />
            )}

            <ConstraintsPanel
              tenderers={tenderers}
              contracts={contracts}
              prices={prices}
              tendererNames={tendererNames}
              contractNames={contractNames}
              selectedContracts={selectedContracts}
              forced={forced}
              forbidden={forbidden}
              maxWins={maxWins}
              setForced={setForced}
              setForbidden={setForbidden}
              setMaxWins={setMaxWins}
            />
          </TabsContent>

          <TabsContent value="random" className="space-y-6">
            <RandomPanel
              contracts={contracts}
              setContracts={setContracts}
              tenderers={tenderers}
              setTenderers={setTenderers}
              priceMin={priceMin}
              setPriceMin={setPriceMin}
              priceMax={priceMax}
              setPriceMax={setPriceMax}
              discountMax={discountMax}
              setDiscountMax={setDiscountMax}
              useAverageDOP={useAverageDOP}
              setUseAverageDOP={setUseAverageDOP}
              fastMode={fastMode}
              setFastMode={setFastMode}
              format={formatCurrency}
              onCalculate={calculateRandom}
              isCalculating={isCalculating}
            />
            <ConstraintsPanel
              tenderers={tenderers}
              contracts={contracts}
              prices={prices}
              tendererNames={tendererNames}
              contractNames={contractNames}
              selectedContracts={selectedContracts}
              forced={forced}
              forbidden={forbidden}
              maxWins={maxWins}
              setForced={setForced}
              setForbidden={setForbidden}
              setMaxWins={setMaxWins}
            />
          </TabsContent>
        </Tabs>

        {results && (
          <ResultsSection
            view={{
              results,
              tenderers,
              contracts,
              tendererNames,
              contractNames,
              selectedContracts,
              forced,
              forbidden,
              showAbbreviated: showAbbreviatedAmounts,
              fastMode,
              useAverageDOP,
              format: formatCurrency,
            }}
            displayedCombinations={displayedCombinations}
            onLoadMore={loadMoreCombinations}
            onToggleAbbreviated={setShowAbbreviatedAmounts}
            comparison={comparison}
            onSnapshot={setComparisonSnapshot}
            onClearComparison={() => setComparison(null)}
            whatIf={whatIf}
            setWhatIf={setWhatIf}
            onComputeWhatIf={computeWhatIf}
            isCalculating={isCalculating}
          />
        )}
      </main>

      <div className="fixed right-0 top-0 hidden h-screen w-96 lg:block">
        <HistorySidebar {...historyProps} />
      </div>
      <MobileHistoryDrawer
        open={mobileHistoryOpen}
        onClose={() => setMobileHistoryOpen(false)}
        {...historyProps}
      />
    </div>
  );
}
