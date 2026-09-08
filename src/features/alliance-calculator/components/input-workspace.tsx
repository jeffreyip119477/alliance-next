"use client";

import type React from "react";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "lucide-react";
import { PriceGrid } from "./inputs/price-grid";
import { DiscountGrid } from "./inputs/discount-grid";
import { ConstraintsPanel } from "./inputs/constraints-panel";
import { RandomPanel } from "./inputs/random-panel";
import { NameEditor } from "./name-editor";
import type { ResultsView } from "../types";

export interface InputWorkspaceProps {
  contracts: number;
  setContracts: (value: number) => void;
  tenderers: number;
  setTenderers: (value: number) => void;
  prices: number[][];
  discounts: number[][][];
  tendererNames: string[];
  setTendererNames: (value: string[]) => void;
  contractNames: string[];
  setContractNames: (value: string[]) => void;
  selectedContracts: number[];
  setSelectedContracts: React.Dispatch<React.SetStateAction<number[]>>;
  useAverageDOP: boolean;
  setUseAverageDOP: (value: boolean) => void;
  fastMode: boolean;
  setFastMode: (value: boolean) => void;
  priceMin: number;
  setPriceMin: (value: number) => void;
  priceMax: number;
  setPriceMax: (value: number) => void;
  discountMax: number;
  setDiscountMax: (value: number) => void;
  showDiscounts: boolean;
  setShowDiscounts: (value: boolean) => void;
  activeTab: "manual" | "random";
  handleTabChange: (value: string) => void;
  forced: (number | null)[];
  forbidden: boolean[][];
  maxWins: number[];
  setForced: React.Dispatch<React.SetStateAction<(number | null)[]>>;
  setForbidden: React.Dispatch<React.SetStateAction<boolean[][]>>;
  setMaxWins: React.Dispatch<React.SetStateAction<number[]>>;
  showAbbreviatedAmounts: boolean;
  formatCurrency: ResultsView["format"];
  handlePriceChange: (t: number, c: number, value: string) => void;
  handleDiscountChange: (t: number, c: number, dop: number, value: string) => void;
  calculate: () => void;
  calculateRandom: () => void;
  isCalculating: boolean;
}

export function InputWorkspace({
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
  forbidden,
  maxWins,
  setForced,
  setForbidden,
  setMaxWins,
  showAbbreviatedAmounts,
  formatCurrency,
  handlePriceChange,
  handleDiscountChange,
  calculate,
  calculateRandom,
  isCalculating,
}: InputWorkspaceProps) {
  const toggleContract = (contractIndex: number) =>
    setSelectedContracts((previous) => {
      const current =
        previous.length === 0
          ? Array.from({ length: contracts }, (_, index) => index)
          : previous;
      return (
        current.includes(contractIndex)
          ? current.filter((index) => index !== contractIndex)
          : [...current, contractIndex]
      ).sort((a, b) => a - b);
    });

  const constraints = (
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
  );

  return (
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
                      (average DoP prices each contract at the tenderer&apos;s mean discount across the contracts it bids)
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
              <Label htmlFor="fastMode">Fast mode (best award / optimal ties)</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground">
                      (keeps the search under control on big grids)
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Fast mode keeps the exact best award and avoids
                    materializing a large assignment set. On small grids,
                    tied-optimal configurations remain available.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-2">
              <Label>Contract Selection</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                {Array.from({ length: contracts }).map((_, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox
                      id={`contract-${index}`}
                      checked={
                        selectedContracts.length === 0 ||
                        selectedContracts.includes(index)
                      }
                      onCheckedChange={() => toggleContract(index)}
                      suppressHydrationWarning
                    />
                    <Label htmlFor={`contract-${index}`} className="cursor-pointer">
                      {contractNames[index] || `C${index + 1}`}
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
              Give tenderers and contracts meaningful names — they appear in the
              results and PDF export.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tenderers</Label>
              <NameEditor
                count={tenderers}
                names={tendererNames}
                setNames={setTendererNames}
                label="Tenderer"
                prefix="tenderer-name"
              />
            </div>
            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm font-medium">Contracts</Label>
              <NameEditor
                count={contracts}
                names={contractNames}
                setNames={setContractNames}
                label="Contract"
                prefix="contract-name"
              />
            </div>
          </CardContent>
        </Card>

        {constraints}

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
            onPriceChange={(t, c, value) => handlePriceChange(t, c, String(value))}
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
            onDiscountChange={(t, c, dop, value) =>
              handleDiscountChange(t, c, dop, String(value))
            }
            onBack={() => setShowDiscounts(false)}
            onCalculate={calculate}
            isCalculating={isCalculating}
          />
        )}
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
        {constraints}
      </TabsContent>
    </Tabs>
  );
}
