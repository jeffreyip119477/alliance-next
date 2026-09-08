"use client";

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
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Database, Loader2 } from "lucide-react";

export interface RandomPanelProps {
  contracts: number;
  setContracts: (n: number) => void;
  tenderers: number;
  setTenderers: (n: number) => void;
  priceMin: number;
  setPriceMin: (n: number) => void;
  priceMax: number;
  setPriceMax: (n: number) => void;
  discountMax: number;
  setDiscountMax: (n: number) => void;
  useAverageDOP: boolean;
  setUseAverageDOP: (b: boolean) => void;
  fastMode: boolean;
  setFastMode: (b: boolean) => void;
  format: (value: number, abbreviated?: boolean) => string;
  onCalculate: () => void;
  isCalculating: boolean;
}

export function RandomPanel({
  contracts,
  setContracts,
  tenderers,
  setTenderers,
  priceMin,
  setPriceMin,
  priceMax,
  setPriceMax,
  discountMax,
  setDiscountMax,
  useAverageDOP,
  setUseAverageDOP,
  fastMode,
  setFastMode,
  format,
  onCalculate,
  isCalculating,
}: RandomPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Random Data Generation
        </CardTitle>
        <CardDescription>
          Generate random data for testing and simulation purposes.
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
                  {format(priceMin, true)} – {format(priceMax, true)}
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
                <span>{format(1, true)}</span>
                <span>{format(1000000, true)}</span>
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
          />
          <Label htmlFor="random-averageDOP">
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
          <Switch
            id="random-fastMode"
            checked={fastMode}
            onCheckedChange={setFastMode}
          />
          <Label htmlFor="random-fastMode">Fast mode (best award / optimal ties)</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground">
                  (keeps the search under control on big grids)
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Fast mode keeps the exact best award and avoids materializing a
                large assignment set. On small grids, tied-optimal
                configurations remain available.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex justify-end">
          <Button onClick={onCalculate} disabled={isCalculating}>
            {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate &amp; Calculate Results
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
