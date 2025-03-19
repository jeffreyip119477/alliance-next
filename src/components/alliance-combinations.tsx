"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAllianceCombinations } from "@/hooks/useAllianceCombinations";

export default function AllianceCombinationsCalculator() {
  const {
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
  } = useAllianceCombinations();

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Alliance Combinations (v3.0.1)</h1>

      <Tabs defaultValue="manual" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="manual">Manual Input</TabsTrigger>
          <TabsTrigger value="random">Random Generation</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="contracts">Contracts ({contracts})</Label>
                  <span className="text-sm text-muted-foreground">1-7</span>
                </div>
                <Slider
                  id="contracts"
                  min={1}
                  max={7}
                  step={1}
                  value={[contracts]}
                  onValueChange={(value) => setContracts(value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tenderers">Tenderers ({tenderers})</Label>
                  <span className="text-sm text-muted-foreground">1-40</span>
                </div>
                <Slider
                  id="tenderers"
                  min={1}
                  max={40}
                  step={1}
                  value={[tenderers]}
                  onValueChange={(value) => setTenderers(value[0])}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="threshold">Combination Threshold (Exhaustive if ≤)</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  value={threshold}
                  onChange={(e) => setThreshold(Number.parseInt(e.target.value) || 5000)}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="averageDOP"
                  checked={useAverageDOP}
                  onCheckedChange={setUseAverageDOP}
                />
                <Label htmlFor="averageDOP">Use Average Discount per DoP Across Contracts</Label>
              </div>
            </CardContent>
          </Card>

          {!showDiscounts ? (
            <Card>
              <CardHeader>
                <CardTitle>Base Prices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenderer</TableHead>
                        {Array.from({ length: contracts }).map((_, i) => (
                          <TableHead key={i}>C{i + 1}</TableHead>
                        ))}
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: tenderers }).map((_, t) => (
                        <TableRow key={t}>
                          <TableCell>T{t + 1}</TableCell>
                          {Array.from({ length: contracts }).map((_, c) => (
                            <TableCell key={c}>
                              <Input
                                type="number"
                                min={0}
                                step={1000}
                                value={prices[t]?.[c] || 0}
                                onChange={(e) => handlePriceChange(t, c, e.target.value)}
                                className="w-full"
                              />
                            </TableCell>
                          ))}
                          <TableCell className="font-bold w-64">
                            {formatCurrency(safeArrayReduce(prices[t], 0))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button onClick={() => setShowDiscounts(true)}>Continue to Discounts</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Discount Percentages (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenderer</TableHead>
                        {Array.from({ length: contracts }).map((_, i) => (
                          <TableHead key={i}>C{i + 1}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: tenderers }).map((_, t) => (
                        <TableRow key={t}>
                          <TableCell>T{t + 1}</TableCell>
                          {Array.from({ length: contracts }).map((_, c) => (
                            <TableCell key={c} className="p-2">
                              <div className="space-y-2">
                                {Array.from({ length: contracts }).map((_, dop) => (
                                  <div key={dop} className="flex items-center space-x-2">
                                    <span className="text-xs w-12">DoP {dop + 1}:</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step={0.01}
                                      value={discounts[t]?.[c]?.[dop] || 0}
                                      onChange={(e) =>
                                        handleDiscountChange(t, c, dop, e.target.value)
                                      }
                                      disabled={!prices[t] || prices[t][c] === 0}
                                      className="w-20"
                                    />
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex justify-between">
                  <Button variant="outline" onClick={() => setShowDiscounts(false)}>
                    Back to Prices
                  </Button>
                  <Button onClick={calculateResults}>Calculate Results</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="random" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Random Data Generation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="random-contracts">Contracts ({contracts})</Label>
                  <span className="text-sm text-muted-foreground">1-7</span>
                </div>
                <Slider
                  id="random-contracts"
                  min={1}
                  max={7}
                  step={1}
                  value={[contracts]}
                  onValueChange={(value) => setContracts(value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="random-tenderers">Tenderers ({tenderers})</Label>
                  <span className="text-sm text-muted-foreground">1-20</span>
                </div>
                <Slider
                  id="random-tenderers"
                  min={1}
                  max={20}
                  step={1}
                  value={[tenderers]}
                  onValueChange={(value) => setTenderers(value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="price-range">
                    Price Range ({formatCurrency(priceMin)} - {formatCurrency(priceMax)})
                  </Label>
                  <span className="text-sm text-muted-foreground">1-1,000,000</span>
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
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="discount-max">Max Discount % ({discountMax})</Label>
                  <span className="text-sm text-muted-foreground">0-100</span>
                </div>
                <Slider
                  id="discount-max"
                  min={0}
                  max={100}
                  step={1}
                  value={[discountMax]}
                  onValueChange={(value) => setDiscountMax(value[0])}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="random-threshold">Combination Threshold (Exhaustive if ≤)</Label>
                <Input
                  id="random-threshold"
                  type="number"
                  min={1}
                  value={threshold}
                  onChange={(e) => setThreshold(Number.parseInt(e.target.value) || 5000)}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="random-averageDOP"
                  checked={useAverageDOP}
                  onCheckedChange={setUseAverageDOP}
                />
                <Label htmlFor="random-averageDOP">
                  Use Average Discount per DoP Across Contracts
                </Label>
              </div>

              <div className="flex justify-end">
                <Button onClick={calculateRandomResults}>Calculate Results</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {results && (
        <div className="mt-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-pink-200 mr-2"></div>
                  <span>Lowest base price for a contract</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-100 mr-2"></div>
                  <span>Selected DoP or best combination</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-200 mr-2"></div>
                  <span>Discounted amount &gt; lowest base price</span>
                </div>
                {useAverageDOP &&
                  results.dopDifferences &&
                  results.dopDifferences.some((t) => t && t.some((d) => d)) && (
                    <div className="flex items-center">
                      <span className="text-red-500 mr-2">Red text</span>
                      <span>Averaged discount percentage</span>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Results Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    Total Lowest Base Prices
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(results.totalLowestBase)}
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    Total Selected Discounted
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(results.totalSelectedDiscounted)}
                  </div>
                </div>
                <div className="p-4 border rounded-lg bg-green-50">
                  <div className="text-sm text-muted-foreground">Cost Saving</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(results.costSaving)}
                  </div>
                </div>
              </div>

              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Combinations</AlertTitle>
                <AlertDescription>
                  Total valid combinations: {results.totalCombos} out of{" "}
                  {results.totalPossibleCombos}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Base Prices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenderer</TableHead>
                      {Array.from({ length: contracts }).map((_, i) => (
                        <TableHead key={i}>C{i + 1}</TableHead>
                      ))}
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: tenderers }).map((_, t) => {
                      const tenderTotal = results.prices && results.prices[t]
                        ? safeArrayReduce(results.prices[t], 0)
                        : 0;

                      return (
                        <TableRow key={t}>
                          <TableCell>T{t + 1}</TableCell>
                          {Array.from({ length: contracts }).map((_, c) => {
                            const price = results.prices && results.prices[t]
                              ? results.prices[t][c] || 0
                              : 0;
                            const isLowest =
                              price > 0 &&
                              results.prices &&
                              price === Math.min(
                                ...results.prices
                                  .map((tender) => tender && tender[c])
                                  .filter((p) => p && p > 0)
                              );

                            return (
                              <TableCell key={c} className={isLowest ? "bg-pink-200" : ""}>
                                {formatCurrency(price)}
                              </TableCell>
                            );
                          })}
                          <TableCell className="font-bold">
                            {formatCurrency(tenderTotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Discounts and Amounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenderer</TableHead>
                      {Array.from({ length: contracts }).map((_, i) => (
                        <TableHead key={i}>C{i + 1}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: tenderers }).map((_, t) => (
                      <TableRow key={t}>
                        <TableCell>T{t + 1}</TableCell>
                        {Array.from({ length: contracts }).map((_, c) => {
                          const base = results.prices && results.prices[t]
                            ? results.prices[t][c] || 0
                            : 0;
                          const lowestBase = results.prices
                            ? Math.min(
                                ...results.prices
                                  .map((tender) => tender && tender[c])
                                  .filter((p) => p && p > 0)
                              )
                            : 0;
                          const dop =
                            results.bestCombo &&
                            results.bestCombo.assignment &&
                            results.bestCombo.assignment[c] === t &&
                            results.bestCombo.tendererCounts
                              ? results.bestCombo.tendererCounts[t] - 1
                              : -1;

                          if (base === 0) {
                            return <TableCell key={c}>-</TableCell>;
                          }

                          return (
                            <TableCell key={c} className="p-2">
                              <div className="space-y-1 text-xs">
                                {Array.from({ length: contracts }).map((_, i) => {
                                  if (
                                    !results.discounts ||
                                    !results.discounts[t] ||
                                    !results.discounts[t][c]
                                  ) {
                                    return null;
                                  }

                                  const discountFraction = Number(
                                    ((results.discounts[t][c][i] || 0) / 100).toFixed(4)
                                  );
                                  const amount = Number(
                                    (base * (1 - discountFraction)).toFixed(2)
                                  );
                                  const isSelected = i === dop;
                                  const exceedsLowest = amount > lowestBase;

                                  return (
                                    <div
                                      key={i}
                                      className={`
                                        ${isSelected ? "font-bold bg-blue-100" : ""}
                                        ${exceedsLowest ? "bg-gray-200" : ""}
                                      `}
                                    >
                                      DoP {i + 1}: {formatCurrency(amount)} (
                                      <span>{(results.discounts[t][c][i] || 0).toFixed(2)}%</span>)
                                    </div>
                                  );
                                })}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {results.bestCombo && (
            <Card>
              <CardHeader>
                <CardTitle>Best Combination</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenderer</TableHead>
                        {Array.from({ length: contracts }).map((_, i) => (
                          <TableHead key={i}>C{i + 1}</TableHead>
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
                        const tendererTotal = tendererCosts.reduce(
                          (sum, cost) => sum + (cost || 0),
                          0
                        );

                        return (
                          <TableRow key={t}>
                            <TableCell>T{t + 1}</TableCell>
                            {Array.from({ length: contracts }).map((_, c) => (
                              <TableCell
                                key={c}
                                className={
                                  results.bestCombo?.assignment &&
                                  results.bestCombo?.assignment[c] === t
                                    ? "bg-blue-100"
                                    : ""
                                }
                              >
                                {tendererCosts[c] > 0
                                  ? formatCurrency(tendererCosts[c])
                                  : "-"}
                              </TableCell>
                            ))}
                            <TableCell className="font-bold">
                              {tendererTotal > 0 ? formatCurrency(tendererTotal) : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-gray-50">
                        <TableCell className="font-bold">Total</TableCell>
                        {Array.from({ length: contracts }).map((_, c) => {
                          const columnTotal = results.bestCombo?.contractCosts
                            ? results.bestCombo.contractCosts[c] || 0
                            : 0;
                          return (
                            <TableCell key={c} className="font-bold">
                              {formatCurrency(columnTotal)}
                            </TableCell>
                          );
                        })}
                        <TableCell className="font-bold">
                          {formatCurrency(results.bestCombo.total)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {results.combinations && results.combinations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Valid Combinations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Array.from({ length: contracts }).map((_, i) => (
                          <TableHead key={i}>C{i + 1}</TableHead>
                        ))}
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.combinations.slice(0, displayedCombinations).map((combo, index) => {
                        if (!combo) return null;

                        const isBest = index === 0;

                        const lowestBaseAssignment = Array(contracts).fill(-1);
                        const lowestBaseCosts = Array(contracts).fill(0);

                        for (let c = 0; c < contracts; c++) {
                          if (!results.prices) continue;

                          const validPrices = results.prices
                            .map((t, i) => ({
                              price: t && t[c],
                              tenderer: i,
                            }))
                            .filter((p) => p.price && p.price > 0);

                          if (validPrices.length > 0) {
                            const minPrice = Math.min(...validPrices.map((p) => p.price));
                            const minTenderer = validPrices.find((p) => p.price === minPrice)?.tenderer;
                            if (minTenderer !== undefined) {
                              lowestBaseAssignment[c] = minTenderer;
                              lowestBaseCosts[c] = minPrice;
                            }
                          }
                        }

                        const isLowestBase = combo.assignment.every(
                          (t, c) => t === lowestBaseAssignment[c]
                        );

                        return (
                          <TableRow
                            key={index}
                            className={`
                              ${isBest ? "bg-blue-100" : ""}
                              ${isLowestBase ? "bg-pink-200" : ""}
                            `}
                          >
                            {Array.from({ length: contracts }).map((_, c) => {
                              const tenderer = combo.assignment ? combo.assignment[c] : -1;
                              const cost = combo.contractCosts ? combo.contractCosts[c] : 0;
                              return (
                                <TableCell key={c}>
                                  {tenderer >= 0
                                    ? `T${tenderer + 1}: ${formatCurrency(cost)}`
                                    : "-"}
                                </TableCell>
                              );
                            })}
                            <TableCell className="font-bold">
                              {formatCurrency(combo.total)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {results.combinations.length > displayedCombinations && (
                  <div className="mt-4 flex justify-center">
                    <Button onClick={loadMoreCombinations}>
                      Load More ({results.combinations.length - displayedCombinations} remaining)
                    </Button>
                  </div>
                )}
                {results.combinations.length > 50 && (
                  <div className="mt-2 text-center text-sm text-muted-foreground">
                    Showing {Math.min(displayedCombinations, results.combinations.length)} of{" "}
                    {results.combinations.length} combinations
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}