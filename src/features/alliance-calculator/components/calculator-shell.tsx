"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { CalculatorHeader } from "./calculator-header";
import { InputWorkspace } from "./input-workspace";
import { PdfExportDialog } from "./pdf-export-dialog";
import { ResultsSection } from "./results/results-section";
import HistorySidebar, { MobileHistoryDrawer } from "./history/history-sidebar";
import { useAllianceCombinations } from "../hooks/use-alliance-combinations";

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8 lg:pr-96">
        <PdfExportDialog
          results={results}
          tendererNames={tendererNames}
          contractNames={contractNames}
          whatIf={whatIf}
          forced={forced}
          forbidden={forbidden}
          selectedContracts={selectedContracts}
        >
          {({ open, hasResults }) => (
            <CalculatorHeader
              hasResults={hasResults}
              onExportPdf={open}
              onLoadShowcase={loadShowcaseData}
              onNewCalculation={newCalculation}
              onOpenHistory={() => setMobileHistoryOpen(true)}
            />
          )}
        </PdfExportDialog>

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

        <InputWorkspace
          contracts={contracts}
          setContracts={setContracts}
          tenderers={tenderers}
          setTenderers={setTenderers}
          prices={prices}
          discounts={discounts}
          tendererNames={tendererNames}
          setTendererNames={setTendererNames}
          contractNames={contractNames}
          setContractNames={setContractNames}
          selectedContracts={selectedContracts}
          setSelectedContracts={setSelectedContracts}
          useAverageDOP={useAverageDOP}
          setUseAverageDOP={setUseAverageDOP}
          fastMode={fastMode}
          setFastMode={setFastMode}
          priceMin={priceMin}
          setPriceMin={setPriceMin}
          priceMax={priceMax}
          setPriceMax={setPriceMax}
          discountMax={discountMax}
          setDiscountMax={setDiscountMax}
          showDiscounts={showDiscounts}
          setShowDiscounts={setShowDiscounts}
          activeTab={activeTab}
          handleTabChange={handleTabChange}
          forced={forced}
          forbidden={forbidden}
          maxWins={maxWins}
          setForced={setForced}
          setForbidden={setForbidden}
          setMaxWins={setMaxWins}
          showAbbreviatedAmounts={showAbbreviatedAmounts}
          formatCurrency={formatCurrency}
          handlePriceChange={handlePriceChange}
          handleDiscountChange={handleDiscountChange}
          calculate={calculate}
          calculateRandom={calculateRandom}
          isCalculating={isCalculating}
        />

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
