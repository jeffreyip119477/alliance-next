"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function ContractCalculator() {
  const [contracts, setContracts] = useState(2)
  const [tenderers, setTenderers] = useState(2)
  const [threshold, setThreshold] = useState(5000)
  const [useAverageDOP, setUseAverageDOP] = useState(false)
  const [prices, setPrices] = useState<number[][]>([])
  const [discounts, setDiscounts] = useState<number[][][]>([])
  const [results, setResults] = useState<any>(null)
  const [showDiscounts, setShowDiscounts] = useState(false)
  const [activeTab, setActiveTab] = useState("manual")

  // Initialize prices and discounts when contracts or tenderers change
  useEffect(() => {
    initializePricesAndDiscounts()
  }, [contracts, tenderers])

  const initializePricesAndDiscounts = () => {
    const newPrices = Array(tenderers)
      .fill(0)
      .map(() => Array(contracts).fill(0))

    const newDiscounts = Array(tenderers)
      .fill(0)
      .map(() =>
        Array(contracts)
          .fill(0)
          .map(() => Array(contracts).fill(0)),
      )

    setPrices(newPrices)
    setDiscounts(newDiscounts)
    setResults(null)
    setShowDiscounts(false)
  }

  const handlePriceChange = (t: number, c: number, value: string) => {
    const newPrices = [...prices]
    newPrices[t][c] = Number(Number.parseFloat(value).toFixed(2)) || 0
    setPrices(newPrices)
  }

  const handleDiscountChange = (t: number, c: number, dop: number, value: string) => {
    const newDiscounts = [...discounts]
    newDiscounts[t][c][dop] = Number(Number.parseFloat(value).toFixed(2)) || 0
    setDiscounts(newDiscounts)
  }

  const generateRandomData = () => {
    const priceMin = 100
    const priceMax = 1000
    const discountMax = 20

    const newPrices = Array(tenderers)
      .fill(0)
      .map(() =>
        Array(contracts)
          .fill(0)
          .map(() => Number((Math.floor(Math.random() * (priceMax - priceMin + 1)) + priceMin).toFixed(2))),
      )

    const newDiscounts = Array(tenderers)
      .fill(0)
      .map(() =>
        Array(contracts)
          .fill(0)
          .map(() => {
            const dops = Array(contracts).fill(0)
            for (let dop = 1; dop < contracts; dop++) {
              dops[dop] = Number((Math.random() * discountMax).toFixed(2))
            }
            return dops
          }),
      )

    return { newPrices, newDiscounts }
  }

  const calculateResults = () => {
    try {
      const results = generateResults(prices, discounts, contracts, tenderers, threshold, useAverageDOP)
      setResults(results)
    } catch (error) {
      console.error("Error calculating results:", error)
    }
  }

  const calculateRandomResults = () => {
    try {
      // Generate random data directly
      const { newPrices, newDiscounts } = generateRandomData()

      // Calculate results using the generated data
      const results = generateResults(newPrices, newDiscounts, contracts, tenderers, threshold, useAverageDOP)

      // Update state with both the random data and results
      setPrices(newPrices)
      setDiscounts(newDiscounts)
      setResults(results)
    } catch (error) {
      console.error("Error calculating random results:", error)
    }
  }

  const generateResults = (
    prices: number[][],
    discounts: number[][][],
    contracts: number,
    tenderers: number,
    threshold = 5000,
    useAverageDOP = false,
  ) => {
    const n = contracts
    const m = tenderers

    // Process discounts (average if requested)
    const processedDiscounts = discounts.map((tenderDiscounts) =>
      tenderDiscounts.map((contractDops) => contractDops.slice()),
    )

    const dopDifferences = Array(m)
      .fill(null)
      .map(() => Array(n).fill(false))

    if (useAverageDOP) {
      for (let t = 0; t < m; t++) {
        const avgDiscounts = Array(n).fill(0)
        for (let dop = 0; dop < n; dop++) {
          const validDops = processedDiscounts[t]
            .map((contractDops) => contractDops[dop])
            .filter((d, c) => prices[t][c] > 0)
          if (validDops.length > 0) {
            const avg = validDops.reduce((sum, d) => sum + d, 0) / validDops.length
            avgDiscounts[dop] = Number(avg.toFixed(2))
            // Check if this DoP differs across contracts
            const allSame = validDops.every((d) => d === validDops[0])
            dopDifferences[t][dop] = !allSame && validDops.length > 1
          }
        }
        for (let c = 0; c < n; c++) {
          processedDiscounts[t][c] = avgDiscounts.slice()
        }
      }
    }

    // Calculate lowest base prices for each contract
    const lowestBasePrices = Array(n)
      .fill(0)
      .map((_, j) => {
        const validPrices = prices.map((t) => t[j]).filter((p) => p > 0)
        return validPrices.length > 0 ? Number(Math.min(...validPrices).toFixed(2)) : 0
      })

    const totalLowestBase = Number(lowestBasePrices.reduce((a, b) => a + b, 0).toFixed(2))

    const totalPossibleCombos = Math.pow(m, n)

    // Calculate valid costs for each tenderer, contract, and DoP
    const validCosts = Array(m)
      .fill(null)
      .map(() =>
        Array(n)
          .fill(null)
          .map(() => []),
      )

    function calculateContractCost(tenderer: number, contract: number, dop: number) {
      if (prices[tenderer][contract] === 0) return Number.POSITIVE_INFINITY
      const discountPercentage = processedDiscounts[tenderer][contract][dop]
      const discount = Number((discountPercentage / 100).toFixed(4))
      const cost = prices[tenderer][contract] * (1 - discount)
      return Number(cost.toFixed(2))
    }

    for (let t = 0; t < m; t++) {
      for (let c = 0; c < n; c++) {
        if (prices[t][c] === 0) continue
        for (let dop = 0; dop < n; dop++) {
          const cost = calculateContractCost(t, c, dop)
          if (cost !== Number.POSITIVE_INFINITY && cost <= lowestBasePrices[c]) {
            validCosts[t][c].push({ dop, cost })
          }
        }
        if (validCosts[t][c].length === 0 && prices[t][c] > 0 && prices[t][c] <= lowestBasePrices[c]) {
          validCosts[t][c].push({
            dop: 0,
            cost: Number(prices[t][c].toFixed(2)),
          })
        }
      }
    }

    // Identify valid contracts
    const validContracts = Array(n)
      .fill(false)
      .map((_, c) => validCosts.some((t) => t[c].length > 0))

    const validContractIndices = validContracts.map((valid, idx) => (valid ? idx : -1)).filter((idx) => idx !== -1)

    const numValidContracts = validContractIndices.length

    const combinations: any[] = []
    let bestTotal = Number.POSITIVE_INFINITY

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
        dopDifferences,
      }
    }

    const adjustedTotalPossibleCombos = Math.pow(m, numValidContracts)

    function exhaustiveSearch(current: number[] = [], tendererCounts: number[] = Array(m).fill(0)) {
      if (current.length === numValidContracts) {
        const fullAssignment = Array(n).fill(-1)
        const contractCosts = Array(n).fill(0)
        validContractIndices.forEach((contractIdx, i) => {
          const tenderer = current[i]
          fullAssignment[contractIdx] = tenderer
          const validOptions = validCosts[tenderer][contractIdx]
          const dop = tendererCounts[tenderer] - 1
          const option = validOptions.find((o: any) => o.dop === dop) || validOptions.find((o: any) => o.dop === 0)
          contractCosts[contractIdx] = option ? option.cost : Number.POSITIVE_INFINITY
        })
        const total = Number(contractCosts.reduce((a, b) => a + b, 0).toFixed(2))
        if (total !== Number.POSITIVE_INFINITY) {
          combinations.push({
            assignment: fullAssignment.slice(),
            total,
            contractCosts: contractCosts.map((cost) => Number(cost.toFixed(2))),
            tendererCounts: tendererCounts.slice(),
          })
          bestTotal = Math.min(bestTotal, total)
        }
        return
      }
      const contractIdx = validContractIndices[current.length]
      for (let t = 0; t < m; t++) {
        if (validCosts[t][contractIdx].length === 0) continue
        const newCounts = tendererCounts.slice()
        newCounts[t]++
        exhaustiveSearch([...current, t], newCounts)
      }
    }

    function branchAndBound(current: number[] = [], tendererCounts: number[] = Array(m).fill(0), currentTotal = 0) {
      if (current.length === numValidContracts) {
        const fullAssignment = Array(n).fill(-1)
        const contractCosts = Array(n).fill(0)
        validContractIndices.forEach((contractIdx, i) => {
          const tenderer = current[i]
          fullAssignment[contractIdx] = tenderer
          const validOptions = validCosts[tenderer][contractIdx]
          const dop = tendererCounts[tenderer] - 1
          const option = validOptions.find((o: any) => o.dop === dop) || validOptions.find((o: any) => o.dop === 0)
          contractCosts[contractIdx] = option ? option.cost : Number.POSITIVE_INFINITY
        })
        const total = Number(contractCosts.reduce((a, b) => a + b, 0).toFixed(2))
        if (total !== Number.POSITIVE_INFINITY) {
          combinations.push({
            assignment: fullAssignment.slice(),
            total,
            contractCosts: contractCosts.map((cost) => Number(cost.toFixed(2))),
            tendererCounts: tendererCounts.slice(),
          })
          bestTotal = Math.min(bestTotal, total)
        }
        return
      }

      const contractIdx = validContractIndices[current.length]
      for (let t = 0; t < m; t++) {
        const validOptions = validCosts[t][contractIdx]
        if (validOptions.length === 0) continue

        const newCounts = tendererCounts.slice()
        newCounts[t]++
        const dop = newCounts[t] - 1
        const option = validOptions.find((o: any) => o.dop === dop) || validOptions.find((o: any) => o.dop === 0)
        const cost = option ? option.cost : Number.POSITIVE_INFINITY

        if (cost === Number.POSITIVE_INFINITY) continue

        branchAndBound([...current, t], newCounts, Number((currentTotal + cost).toFixed(2)))
      }
    }

    if (adjustedTotalPossibleCombos <= threshold) {
      exhaustiveSearch()
    } else {
      branchAndBound()
    }

    combinations.sort((a, b) => a.total - b.total)

    const bestCombo = combinations[0] || null
    const totalSelectedDiscounted = bestCombo ? bestCombo.total : totalLowestBase
    const costSaving = Number(Math.max(0, totalLowestBase - totalSelectedDiscounted).toFixed(2))

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
      dopDifferences,
    }
  }

  const formatCurrency = (value: number | undefined | null) => {
    // Handle undefined or null values
    if (value === undefined || value === null) {
      return "$0.00"
    }

    try {
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    } catch (error) {
      console.error("Error formatting currency:", error, "Value:", value)
      return "$0.00"
    }
  }

  // Ensure prices and discounts arrays are initialized
  useEffect(() => {
    if (!prices.length || prices.length !== tenderers || (prices.length > 0 && prices[0].length !== contracts)) {
      initializePricesAndDiscounts()
    }
  }, [])

  // Safe array access helper
  const safeArrayReduce = (arr: number[] | undefined, initialValue: number) => {
    if (!arr || !Array.isArray(arr)) return initialValue
    return arr.reduce((sum, val) => sum + (val || 0), initialValue)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Contract Assignment with DoP Discounts</h1>

      <Tabs
        defaultValue="manual"
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value)
          if (value === "manual") {
            initializePricesAndDiscounts()
          }
        }}
      >
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
                  <span className="text-sm text-muted-foreground">1-20</span>
                </div>
                <Slider
                  id="tenderers"
                  min={1}
                  max={20}
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
                <Switch id="averageDOP" checked={useAverageDOP} onCheckedChange={setUseAverageDOP} />
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
                                step={0.01}
                                value={prices[t]?.[c] || 0}
                                onChange={(e) => handlePriceChange(t, c, e.target.value)}
                                className="w-24"
                              />
                            </TableCell>
                          ))}
                          <TableCell className="font-bold">{formatCurrency(safeArrayReduce(prices[t], 0))}</TableCell>
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
            <>
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
                                        onChange={(e) => handleDiscountChange(t, c, dop, e.target.value)}
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
            </>
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
                <Switch id="random-averageDOP" checked={useAverageDOP} onCheckedChange={setUseAverageDOP} />
                <Label htmlFor="random-averageDOP">Use Average Discount per DoP Across Contracts</Label>
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
                  <div className="w-4 h-4 bg-green-200 mr-2"></div>
                  <span>Lowest base price for a contract</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-100 mr-2"></div>
                  <span>Selected DoP or best combination</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-black mr-2"></div>
                  <span>Lowest base price combination (red text)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-200 mr-2"></div>
                  <span>Discounted amount &gt; lowest base price</span>
                </div>
                {useAverageDOP &&
                  results.dopDifferences &&
                  results.dopDifferences.some((t: boolean[]) => t && t.some((d: boolean) => d)) && (
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
                  <div className="text-sm text-muted-foreground">Total Lowest Base Prices</div>
                  <div className="text-2xl font-bold">{formatCurrency(results.totalLowestBase)}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Selected Discounted</div>
                  <div className="text-2xl font-bold">{formatCurrency(results.totalSelectedDiscounted)}</div>
                </div>
                <div className="p-4 border rounded-lg bg-green-50">
                  <div className="text-sm text-muted-foreground">Cost Saving</div>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(results.costSaving)}</div>
                </div>
              </div>

              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Combinations</AlertTitle>
                <AlertDescription>
                  Total valid combinations: {results.totalCombos} out of {results.totalPossibleCombos}
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
                      const tenderTotal =
                        results.prices && results.prices[t] ? safeArrayReduce(results.prices[t], 0) : 0

                      return (
                        <TableRow key={t}>
                          <TableCell>T{t + 1}</TableCell>
                          {Array.from({ length: contracts }).map((_, c) => {
                            const price = results.prices && results.prices[t] ? results.prices[t][c] || 0 : 0
                            const isLowest =
                              price > 0 &&
                              results.prices &&
                              price ===
                                Math.min(
                                  ...results.prices
                                    .map((tender: number[]) => tender && tender[c])
                                    .filter((p: number) => p && p > 0),
                                )

                            return (
                              <TableCell key={c} className={isLowest ? "bg-green-200" : ""}>
                                {formatCurrency(price)}
                              </TableCell>
                            )
                          })}
                          <TableCell className="font-bold">{formatCurrency(tenderTotal)}</TableCell>
                        </TableRow>
                      )
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
                          const base = results.prices && results.prices[t] ? results.prices[t][c] || 0 : 0
                          const lowestBase = results.prices
                            ? Math.min(
                                ...results.prices
                                  .map((tender: number[]) => tender && tender[c])
                                  .filter((p: number) => p && p > 0),
                              )
                            : 0
                          const dop =
                            results.bestCombo &&
                            results.bestCombo.assignment &&
                            results.bestCombo.assignment[c] === t &&
                            results.bestCombo.tendererCounts
                              ? results.bestCombo.tendererCounts[t] - 1
                              : -1

                          if (base === 0) {
                            return <TableCell key={c}>-</TableCell>
                          }

                          return (
                            <TableCell key={c} className="p-2">
                              <div className="space-y-1 text-xs">
                                {Array.from({ length: contracts }).map((_, i) => {
                                  if (!results.discounts || !results.discounts[t] || !results.discounts[t][c]) {
                                    return null
                                  }

                                  const discountFraction = Number(((results.discounts[t][c][i] || 0) / 100).toFixed(4))
                                  const amount = Number((base * (1 - discountFraction)).toFixed(2))
                                  const isSelected = i === dop
                                  const exceedsLowest = amount > lowestBase
                                  const isAveragedWithDifference =
                                    useAverageDOP &&
                                    results.dopDifferences &&
                                    results.dopDifferences[t] &&
                                    results.dopDifferences[t][i]

                                  return (
                                    <div
                                      key={i}
                                      className={`
                                        ${isSelected ? "font-bold bg-blue-100" : ""}
                                        ${exceedsLowest ? "bg-gray-200" : ""}
                                      `}
                                    >
                                      DoP {i + 1}: {formatCurrency(amount)} (
                                      <span className={isAveragedWithDifference ? "text-red-500" : ""}>
                                        {(results.discounts[t][c][i] || 0).toFixed(2)}%
                                      </span>
                                      )
                                    </div>
                                  )
                                })}
                              </div>
                            </TableCell>
                          )
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
                        const tendererCosts = Array(contracts).fill(0)
                        if (results.bestCombo.contractCosts && results.bestCombo.assignment) {
                          results.bestCombo.contractCosts.forEach((cost: number, c: number) => {
                            if (results.bestCombo.assignment[c] === t) {
                              tendererCosts[c] = cost || 0
                            }
                          })
                        }
                        const tendererTotal = tendererCosts.reduce((sum: number, cost: number) => sum + (cost || 0), 0)

                        return (
                          <TableRow key={t}>
                            <TableCell>T{t + 1}</TableCell>
                            {Array.from({ length: contracts }).map((_, c) => (
                              <TableCell
                                key={c}
                                className={
                                  results.bestCombo.assignment && results.bestCombo.assignment[c] === t
                                    ? "bg-blue-100"
                                    : ""
                                }
                              >
                                {tendererCosts[c] > 0 ? formatCurrency(tendererCosts[c]) : "-"}
                              </TableCell>
                            ))}
                            <TableCell className="font-bold">
                              {tendererTotal > 0 ? formatCurrency(tendererTotal) : "-"}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      <TableRow className="bg-gray-50">
                        <TableCell className="font-bold">Total</TableCell>
                        {Array.from({ length: contracts }).map((_, c) => {
                          const columnTotal = results.bestCombo.contractCosts
                            ? results.bestCombo.contractCosts[c] || 0
                            : 0
                          return (
                            <TableCell key={c} className="font-bold">
                              {formatCurrency(columnTotal)}
                            </TableCell>
                          )
                        })}
                        <TableCell className="font-bold">{formatCurrency(results.bestCombo.total)}</TableCell>
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
                      {results.combinations.slice(0, 10).map((combo: any, index: number) => {
                        if (!combo) return null

                        const isBest = index === 0

                        // Check if this is the lowest base price combination
                        const lowestBaseAssignment = Array(contracts).fill(-1)
                        const lowestBaseCosts = Array(contracts).fill(0)

                        for (let c = 0; c < contracts; c++) {
                          if (!results.prices) continue

                          const validPrices = results.prices
                            .map((t: number[], i: number) => ({ price: t && t[c], tenderer: i }))
                            .filter((p: any) => p.price && p.price > 0)

                          if (validPrices.length > 0) {
                            const minPrice = Math.min(...validPrices.map((p: any) => p.price))
                            const minTenderer = validPrices.find((p: any) => p.price === minPrice)?.tenderer
                            if (minTenderer !== undefined) {
                              lowestBaseAssignment[c] = minTenderer
                              lowestBaseCosts[c] = minPrice
                            }
                          }
                        }

                        const isLowestBase =
                          combo.assignment &&
                          combo.assignment.every((t: number, c: number) => t === lowestBaseAssignment[c])

                        return (
                          <TableRow
                            key={index}
                            className={`
                              ${isBest ? "bg-blue-100" : ""}
                              ${isLowestBase ? "bg-black text-red-500" : ""}
                            `}
                          >
                            {Array.from({ length: contracts }).map((_, c) => {
                              const tenderer = combo.assignment ? combo.assignment[c] : -1
                              const cost = combo.contractCosts ? combo.contractCosts[c] : 0
                              return (
                                <TableCell key={c}>
                                  {tenderer >= 0 ? `T${tenderer + 1}: ${formatCurrency(cost)}` : "-"}
                                </TableCell>
                              )
                            })}
                            <TableCell className="font-bold">{formatCurrency(combo.total)}</TableCell>
                          </TableRow>
                        )
                      })}
                      {results.combinations.length > 10 && (
                        <TableRow>
                          <TableCell colSpan={contracts + 1} className="text-center text-muted-foreground">
                            {results.combinations.length - 10} more combinations not shown
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

