"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Info, Calculator, Settings, Database, ChevronDown, ChevronUp, Download } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAllianceCombinations } from "../hooks/useAllianceCombinations"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"



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

  } = useAllianceCombinations()

  const [showLegend, setShowLegend] = useState(true)
  const [tendererNames, setTendererNames] = useState<string[]>([])
  const [selectedContracts, setSelectedContracts] = useState<boolean[]>([])

  // Initialize tenderer names and selected contracts when tenderers or contracts change
  useEffect(() => {
    // Initialize tenderer names if they don't exist or count changed
    if (!tendererNames.length || tendererNames.length !== tenderers) {
      setTendererNames(
        Array(tenderers)
          .fill("")
          .map((_, i) => `T${i + 1}`),
      )
    }

    // Initialize selected contracts if they don't exist or count changed
    if (!selectedContracts.length || selectedContracts.length !== contracts) {
      setSelectedContracts(Array(contracts).fill(true))
    }
  }, [tenderers, contracts, tendererNames.length, selectedContracts.length])

  // Add handler for tenderer name changes
  const handleTendererNameChange = (index: number, name: string) => {
    const newNames = [...tendererNames]
    newNames[index] = name
    setTendererNames(newNames)
  }

  // Add handler for contract selection changes
  const handleContractSelectionChange = (index: number, selected: boolean) => {
    const newSelection = [...selectedContracts]
    newSelection[index] = selected
    setSelectedContracts(newSelection)
  }

  // Replace the calculateSelectedResults function with this implementation
  const calculateSelectedResults = () => {
    // Filter out unselected contracts
    const selectedIndices = selectedContracts
      .map((selected, index) => (selected ? index : -1))
      .filter((index) => index !== -1)

    if (selectedIndices.length === 0) {
      alert("Please select at least one contract")
      return
    }

    // Create a temporary copy of prices and discounts with unselected contracts set to 0
    const tempPrices = [...prices]
    const tempDiscounts = [...discounts]

    // Set prices and discounts for unselected contracts to 0
    for (let t = 0; t < tenderers; t++) {
      for (let c = 0; c < contracts; c++) {
        if (!selectedContracts[c]) {
          if (tempPrices[t]) {
            tempPrices[t][c] = 0
          }
          if (tempDiscounts[t] && tempDiscounts[t][c]) {
            tempDiscounts[t][c] = Array(selectedIndices.length).fill(0)
          }
        } else if (tempDiscounts[t] && tempDiscounts[t][c]) {
          // Ensure the discount array length matches the number of selected contracts
          tempDiscounts[t][c] = tempDiscounts[t][c].slice(0, selectedIndices.length)
          while (tempDiscounts[t][c].length < selectedIndices.length) {
            tempDiscounts[t][c].push(0)
          }
        }
      }
    }

    // Use the existing calculateResults function with our modified data
    try {
      // Store the original prices and discounts
      const originalPrices = [...prices]
      const originalDiscounts = [...discounts]

      // Temporarily replace the prices and discounts with our filtered versions
      prices.splice(0, prices.length, ...tempPrices)
      discounts.splice(0, discounts.length, ...tempDiscounts)

      // Call the existing calculate function
      calculateResults()

      // Restore the original prices and discounts
      setTimeout(() => {
        prices.splice(0, prices.length, ...originalPrices)
        discounts.splice(0, discounts.length, ...originalDiscounts)
      }, 0)
    } catch (error) {
      console.error("Error calculating selected results:", error)
    }
  }

  const exportToCSV = () => {
    if (!results) return

    let csvContent = "data:text/csv;charset=utf-8,"

    // Add header
    csvContent += "Alliance Combinations Results\r\n\r\n"
    csvContent += `Total Lowest Base Prices,${results.totalLowestBase}\r\n`
    csvContent += `Total Selected Discounted,${results.totalSelectedDiscounted}\r\n`
    csvContent += `Cost Saving,${results.costSaving}\r\n\r\n`

    // Add base prices
    csvContent += "Base Prices\r\n"
    let header = "Tenderer,"
    for (let i = 0; i < contracts; i++) {
      if (selectedContracts[i]) {
        header += `C${i + 1},`
      }
    }
    header += "Total\r\n"
    csvContent += header

    for (let t = 0; t < tenderers; t++) {
      let row = `${tendererNames[t] || `T${t + 1}`},`
      for (let c = 0; c < contracts; c++) {
        if (selectedContracts[c]) {
          row += `${results.prices && results.prices[t] ? results.prices[t][c] || 0 : 0},`
        }
      }
      row += `${
        results.prices && results.prices[t]
          ? results.prices[t].filter((_, i) => selectedContracts[i]).reduce((sum, price) => sum + (price || 0), 0)
          : 0
      }\r\n`
      csvContent += row
    }

    // Add discounted amounts
    csvContent += "\r\nDiscounted Amounts\r\n"
    const discountHeader = "Tenderer,Contract,DoP,Base Price,Discount %,Discounted Amount\r\n"
    csvContent += discountHeader

    for (let t = 0; t < tenderers; t++) {
      for (let c = 0; c < contracts; c++) {
        if (!selectedContracts[c]) continue

        const basePrice = results.prices && results.prices[t] ? results.prices[t][c] || 0 : 0
        if (basePrice > 0) {
          for (let dop = 0; dop < contracts; dop++) {
            if (results.discounts && results.discounts[t] && results.discounts[t][c]) {
              const discountPercentage = results.discounts[t][c][dop] || 0
              const discountFraction = Number((discountPercentage / 100).toFixed(4))
              const discountedAmount = Number((basePrice * (1 - discountFraction)).toFixed(2))

              const row = `${tendererNames[t] || `T${t + 1}`},C${c + 1},${dop + 1},${basePrice},${discountPercentage},${discountedAmount}\r\n`
              csvContent += row
            }
          }
        }
      }
    }

    // Add best combination
    if (results.bestCombo) {
      csvContent += "\r\nBest Combination\r\n"
      csvContent += header

      for (let t = 0; t < tenderers; t++) {
        let row = `${tendererNames[t] || `T${t + 1}`},`
        const tendererCosts = Array(contracts).fill(0)

        if (results.bestCombo?.contractCosts && results.bestCombo?.assignment) {
          results.bestCombo.contractCosts.forEach((cost, c) => {
            if (results.bestCombo?.assignment[c] === t) {
              tendererCosts[c] = cost || 0
            }
          })
        }

        for (let c = 0; c < contracts; c++) {
          if (selectedContracts[c]) {
            row += `${tendererCosts[c]},`
          }
        }

        const tendererTotal = tendererCosts
          .filter((_, i) => selectedContracts[i])
          .reduce((sum, cost) => sum + (cost || 0), 0)
        row += `${tendererTotal}\r\n`
        csvContent += row
      }

      // Add total row
      let totalRow = "Total,"
      for (let c = 0; c < contracts; c++) {
        if (selectedContracts[c]) {
          totalRow += `${results.bestCombo.contractCosts ? results.bestCombo.contractCosts[c] || 0 : 0},`
        }
      }
      totalRow += `${results.bestCombo.total}\r\n`
      csvContent += totalRow
    }

    // Add all combinations
    if (results.combinations && results.combinations.length > 0) {
      csvContent += "\r\nAll Combinations\r\n"
      let comboHeader = "Combination #,"
      for (let c = 0; c < contracts; c++) {
        if (selectedContracts[c]) {
          comboHeader += `C${c + 1} Tenderer,C${c + 1} Cost,`
        }
      }
      comboHeader += "Total Cost\r\n"
      csvContent += comboHeader

      results.combinations.forEach((combo, index) => {
        if (!combo) return

        let row = `${index + 1},`
        for (let c = 0; c < contracts; c++) {
          if (selectedContracts[c]) {
            const tenderer = combo.assignment && combo.assignment[c] !== undefined ? combo.assignment[c] : -1
            const cost = combo.contractCosts && combo.contractCosts[c] !== undefined ? combo.contractCosts[c] : 0
            row += `${tenderer >= 0 ? tendererNames[tenderer] || `T${tenderer + 1}` : "None"},${cost},`
          }
        }
        row += `${combo.total}\r\n`
        csvContent += row
      })
    }

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "alliance_combinations_results.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-999 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="container mx-auto py-4 px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Alliance Combinations Calculator</h1>
              <p className="text-sm text-muted-foreground">v3.1.0</p>
            </div>
            {results && (
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export Results
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <Tabs defaultValue="manual" value={activeTab} onValueChange={handleTabChange} className="space-y-8">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuration
                </CardTitle>
                <CardDescription>Set up the parameters for your alliance calculation</CardDescription>
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

                <div className="space-y-2">
                  <Label htmlFor="threshold">Combination Threshold (Exhaustive if ≤)</Label>
                  <Input
                    id="threshold"
                    type="number"
                    min={1}
                    value={threshold}
                    onChange={(e) => setThreshold(Number.parseInt(e.target.value) || 5000)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Determines when to switch from exhaustive to branch-and-bound algorithm
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="averageDOP" checked={useAverageDOP} onCheckedChange={setUseAverageDOP} />
                  <Label htmlFor="averageDOP">Use Average Discount per DoP Across Contracts</Label>
                </div>

                <div className="space-y-2 mt-4">
                  <Label>Contract Selection</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {Array.from({ length: contracts }).map((_, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <Checkbox
                          id={`contract-${i}`}
                          checked={selectedContracts[i]}
                          onCheckedChange={(checked: boolean) => handleContractSelectionChange(i, checked)}
                        />
                        <Label htmlFor={`contract-${i}`}>C{i + 1}</Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Select which contracts to include in the calculation</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tenderer Names</CardTitle>
                <CardDescription>Customize the names of tenderers for better identification</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {Array.from({ length: tenderers }).map((_, t) => (
                    <div key={t} className="space-y-2">
                      <Label htmlFor={`tenderer-name-${t}`}>T{t + 1}</Label>
                      <Input
                        id={`tenderer-name-${t}`}
                        value={tendererNames[t] || `Tenderer ${t + 1}`}
                        onChange={(e) => handleTendererNameChange(t, e.target.value)}
                        placeholder={`Tenderer ${t + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {!showDiscounts ? (
              <Card>
                <CardHeader>
                  <CardTitle>Base Prices</CardTitle>
                  <CardDescription>Enter the base price for each tenderer and contract</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <ScrollArea className="">
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
                          {Array.from({ length: tenderers }).map((_, t) => (
                            <TableRow key={t}>
                              <TableCell className="sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium">
                                {tendererNames[t] || `T${t + 1}`}
                              </TableCell>
                              {Array.from({ length: contracts }).map((_, c) => (
                                <TableCell key={c} className={!selectedContracts[c] ? "opacity-50" : ""}>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1000}
                                    value={prices[t]?.[c] || 0}
                                    onChange={(e) => handlePriceChange(t, c, e.target.value)}
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
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
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
                  <CardDescription>Enter the discount percentage for each degree of preference (DoP)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <ScrollArea className="">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-white dark:bg-gray-800 z-10">Tenderer</TableHead>
                            {Array.from({ length: contracts }).map((_, i) => (
                              <TableHead key={i} className={!selectedContracts[i] ? "opacity-50" : ""}>
                                C{i + 1}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from({ length: tenderers }).map((_, t) => (
                            <TableRow key={t}>
                              <TableCell className="sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium">
                                {tendererNames[t] || `T${t + 1}`}
                              </TableCell>
                              {Array.from({ length: contracts }).map((_, c) => (
                                <TableCell key={c} className={`p-2 ${!selectedContracts[c] ? "opacity-50" : ""}`}>
                                  <div className="space-y-2">
                                    {/* Calculate the number of selected contracts to determine DoP levels */}
                                    {Array.from({ length: selectedContracts.filter(Boolean).length }).map(
                                      (_, dopIndex) => (
                                        <div key={dopIndex} className="flex items-center space-x-2">
                                          <span className="text-xs w-12">DoP {dopIndex + 1}:</span>
                                          <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.01}
                                            value={discounts[t]?.[c]?.[dopIndex] || 0}
                                            onChange={(e) => handleDiscountChange(t, c, dopIndex, e.target.value)}
                                            disabled={!prices[t] || prices[t][c] === 0 || !selectedContracts[c]}
                                            className="w-20"
                                          />
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>

                  <div className="mt-4 flex justify-between">
                    <Button variant="outline" onClick={() => setShowDiscounts(false)}>
                      Back to Prices
                    </Button>
                    <Button onClick={calculateSelectedResults}>Calculate Results</Button>
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
                <CardDescription>Generate random data for testing and simulation purposes</CardDescription>
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
                          {formatCurrency(priceMin)} - {formatCurrency(priceMax)}
                        </Badge>
                      </div>
                      <Slider
                        id="price-range"
                        min={1}
                        max={1000000}
                        step={10000}
                        value={[priceMin, priceMax]}
                        onValueChange={(value) => {
                          setPriceMin(Math.min(...value))
                          setPriceMax(Math.max(...value))
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

                <div className="space-y-2">
                  <Label htmlFor="random-threshold">Combination Threshold (Exhaustive if ≤)</Label>
                  <Input
                    id="random-threshold"
                    type="number"
                    min={1}
                    value={threshold}
                    onChange={(e) => setThreshold(Number.parseInt(e.target.value) || 5000)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Determines when to switch from exhaustive to branch-and-bound algorithm
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="random-averageDOP" checked={useAverageDOP} onCheckedChange={setUseAverageDOP} />
                  <Label htmlFor="random-averageDOP">Use Average Discount per DoP Across Contracts</Label>
                </div>

                <div className="flex justify-end">
                  <Button onClick={calculateRandomResults}>Generate & Calculate Results</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {results && (
          <div className="mt-8 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-bold">Results Summary</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowLegend(!showLegend)} className="h-8 w-8 p-0">
                  {showLegend ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent>
                {showLegend && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="font-medium mb-2">Legend</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-[#FF5E93]/20 dark:bg-[#FF5E93]/30 mr-2 rounded"></div>
                        <span>Lowest base price for a contract</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-[#00B2CA]/20 dark:bg-[#00B2CA]/30 mr-2 rounded"></div>
                        <span>Selected DoP or best combination</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 mr-2 rounded"></div>
                        <span>Discounted amount &gt; lowest base price</span>
                      </div>
                      {useAverageDOP &&
                        results.dopDifferences &&
                        results.dopDifferences.some((t) => t && t.some((d) => d)) && (
                          <div className="flex items-center">
                            <span className="text-[#FF5E93] mr-2">Red text</span>
                            <span>Averaged discount percentage</span>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                    <div className="text-sm text-muted-foreground">Total Lowest Base Prices</div>
                    <div className="text-2xl font-bold">{formatCurrency(results.totalLowestBase)}</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                    <div className="text-sm text-muted-foreground">Total Selected Discounted</div>
                    <div className="text-2xl font-bold">{formatCurrency(results.totalSelectedDiscounted)}</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-[#00B2CA]/10 dark:bg-[#00B2CA]/20 shadow-sm">
                    <div className="text-sm text-muted-foreground dark:text-gray-400">Cost Saving</div>
                    <div className="text-2xl font-bold text-[#00B2CA] dark:text-[#00B2CA]">
                      {formatCurrency(results.costSaving)}
                    </div>
                  </div>
                </div>

                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Combinations</AlertTitle>
                  <AlertDescription>
                    Total valid combinations: {results.totalCombos} out of{" "}
                    {results.totalPossibleCombos.toLocaleString()}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Base Prices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <ScrollArea className="">
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
                            const tenderTotal =
                              results.prices && results.prices[t]
                                ? results.prices[t]
                                    .filter((_, i) => selectedContracts[i])
                                    .reduce((sum, price) => sum + (price || 0), 0)
                                : 0

                            return (
                              <TableRow key={t}>
                                <TableCell className="sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium">
                                  {tendererNames[t] || `T${t + 1}`}
                                </TableCell>
                                {Array.from({ length: contracts }).map((_, c) => {
                                  const price = results.prices && results.prices[t] ? results.prices[t][c] || 0 : 0
                                  const isLowest =
                                    price > 0 &&
                                    results.prices &&
                                    price ===
                                      Math.min(
                                        ...results.prices
                                          .map((tender) => tender && tender[c])
                                          .filter((p) => p && p > 0),
                                      )

                                  return (
                                    <TableCell
                                      key={c}
                                      className={`${isLowest ? "bg-[#FF5E93]/20 dark:bg-[#FF5E93]/30" : ""} ${!selectedContracts[c] ? "opacity-50" : ""}`}
                                    >
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
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              <Card>
              <CardHeader>
                <CardTitle>Discounts and Amounts</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <Table className="w-full max-w-full table-auto">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-white dark:bg-gray-800 z-10">Tenderer</TableHead>
                        {Array.from({ length: contracts }).map((_, i) => (
                          <TableHead key={i} className={!selectedContracts[i] ? "opacity-50" : ""}>
                            C{i + 1}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: tenderers }).map((_, t) => (
                        <TableRow key={t}>
                          <TableCell className="sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium">
                            {tendererNames[t] || `T${t + 1}`}
                          </TableCell>
                          {Array.from({ length: contracts }).map((_, c) => {
                            const base = results.prices && results.prices[t] ? results.prices[t][c] || 0 : 0;
                            const lowestBase = results.prices
                              ? Math.min(
                                  ...results.prices.map((tender) => tender && tender[c]).filter((p) => p && p > 0),
                                )
                              : 0;
                            const dop =
                              results.bestCombo &&
                              results.bestCombo.assignment &&
                              results.bestCombo.assignment[c] === t &&
                              results.bestCombo.tendererCounts
                                ? results.bestCombo.tendererCounts[t] - 1
                                : -1;

                            if (base === 0 || !selectedContracts[c]) {
                              return (
                                <TableCell key={c} className={!selectedContracts[c] ? "opacity-50" : ""}>
                                  -
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell key={c} className="p-1">
                                <div className="space-y-1 text-xs break-words">
                                  {Array.from({ length: selectedContracts.filter(Boolean).length }).map((_, i) => {
                                    if (!results.discounts || !results.discounts[t] || !results.discounts[t][c]) {
                                      return null;
                                    }

                                    const discountFraction = Number(
                                      ((results.discounts[t][c][i] || 0) / 100).toFixed(4),
                                    );
                                    const amount = Number((base * (1 - discountFraction)).toFixed(2));
                                    const isSelected = i === dop;
                                    const exceedsLowest = amount > lowestBase;

                                    return (
                                      <div
                                        key={i}
                                        className={`
                                          rounded px-0 py-0.5 break-words
                                          ${isSelected ? "font-bold bg-[#00B2CA]/20 dark:bg-[#00B2CA]/30" : ""}
                                          ${exceedsLowest ? "bg-gray-200 dark:bg-gray-700" : ""}
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
                </ScrollArea>
              </CardContent>
            </Card>
            </div>

            {results.bestCombo && (
              <Card>
                <CardHeader>
                  <CardTitle>Best Combination</CardTitle>
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
                            const tendererCosts = Array(contracts).fill(0)
                            if (results.bestCombo?.contractCosts && results.bestCombo?.assignment) {
                              results.bestCombo.contractCosts.forEach((cost, c) => {
                                if (results.bestCombo?.assignment[c] === t) {
                                  tendererCosts[c] = cost || 0
                                }
                              })
                            }
                            const tendererTotal = tendererCosts
                              .filter((_, i) => selectedContracts[i])
                              .reduce((sum, cost) => sum + (cost || 0), 0)

                            return (
                              <TableRow key={t}>
                                <TableCell className="sticky left-0 bg-white dark:bg-gray-800 z-10 font-medium">
                                  {tendererNames[t] || `T${t + 1}`}
                                </TableCell>
                                {Array.from({ length: contracts }).map((_, c) => (
                                  <TableCell
                                    key={c}
                                    className={`
                                      ${
                                        results.bestCombo?.assignment && results.bestCombo?.assignment[c] === t
                                          ? "bg-[#00B2CA]/20 dark:bg-[#00B2CA]/30"
                                          : ""
                                      }
                                      ${!selectedContracts[c] ? "opacity-50" : ""}
                                    `}
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
                          <TableRow className="bg-gray-50 dark:bg-gray-800">
                            <TableCell className="sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 font-bold">
                              Total
                            </TableCell>
                            {Array.from({ length: contracts }).map((_, c) => {
                              const columnTotal = results.bestCombo?.contractCosts
                                ? results.bestCombo.contractCosts[c] || 0
                                : 0
                              return (
                                <TableCell key={c} className={`font-bold ${!selectedContracts[c] ? "opacity-50" : ""}`}>
                                  {formatCurrency(columnTotal)}
                                </TableCell>
                              )
                            })}
                            <TableCell className="font-bold">{formatCurrency(results.bestCombo.total)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </ScrollArea>
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
                    <ScrollArea className="">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            {Array.from({ length: contracts }).map((_, i) => (
                              <TableHead key={i} className={!selectedContracts[i] ? "opacity-50" : ""}>
                                C{i + 1}
                              </TableHead>
                            ))}
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.combinations.slice(0, displayedCombinations).map((combo, index) => {
                            if (!combo) return null

                            const isBest = index === 0

                            const lowestBaseAssignment = Array(contracts).fill(-1)
                            const lowestBaseCosts = Array(contracts).fill(0)

                            for (let c = 0; c < contracts; c++) {
                              if (!results.prices) continue

                              const validPrices = results.prices
                                .map((t, i) => ({
                                  price: t && t[c],
                                  tenderer: i,
                                }))
                                .filter((p) => p.price && p.price > 0)

                              if (validPrices.length > 0) {
                                const minPrice = Math.min(...validPrices.map((p) => p.price))
                                const minTenderer = validPrices.find((p) => p.price === minPrice)?.tenderer
                                if (minTenderer !== undefined) {
                                  lowestBaseAssignment[c] = minTenderer
                                  lowestBaseCosts[c] = minPrice
                                }
                              }
                            }

                            const isLowestBase = combo.assignment.every((t, c) => t === lowestBaseAssignment[c])

                            return (
                              <TableRow
                                key={index}
                                className={`
                                  px-0
                                  ${isBest ? "bg-[#00B2CA]/20 dark:bg-[#00B2CA]/30" : ""}
                                  ${isLowestBase ? "bg-[#FF5E93]/20 dark:bg-[#FF5E93]/30" : ""}
                                `}
                              >
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                {Array.from({ length: contracts }).map((_, c) => {
                                  const tenderer = combo.assignment ? combo.assignment[c] : -1
                                  const cost = combo.contractCosts ? combo.contractCosts[c] : 0
                                  return (
                                    <TableCell key={c} className={!selectedContracts[c] ? "opacity-50" : ""}>
                                      {tenderer >= 0
                                        ? <div><TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>{formatCurrency(cost)}</TooltipTrigger>
                                          <TooltipContent>
                                            <p>{tendererNames[tenderer]}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider></div>
                                        : "-"}
                                    </TableCell>
                                  )
                                })}
                                <TableCell className="font-bold">{formatCurrency(combo.total)}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
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
      </main>
    </div>
  )
}

