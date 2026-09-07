"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MoneyInput } from "./money-input";

export interface DiscountGridProps {
  discounts: number[][][];
  prices: number[][];
  tenderers: number;
  contracts: number;
  tendererNames: string[];
  contractNames: string[];
  selectedContracts: number[];
  onDiscountChange: (t: number, c: number, dop: number, value: number) => void;
  onBack: () => void;
  onCalculate: () => void;
  isCalculating: boolean;
}

/**
 * DoP (degree of preference) discount entry grid. Tier d (1-based) applies
 * when a tenderer wins d contracts — the final-count rule — so each cell
 * holds a percentage 0..100.
 */
export function DiscountGrid({
  discounts,
  prices,
  tenderers,
  contracts,
  tendererNames,
  contractNames,
  selectedContracts,
  onDiscountChange,
  onBack,
  onCalculate,
  isCalculating,
}: DiscountGridProps) {
  const selection =
    selectedContracts.length > 0
      ? selectedContracts
      : Array.from({ length: contracts }, (_, i) => i);
  const tierCount = selection.length;
  const isSelected = (c: number) =>
    selectedContracts.length === 0 || selectedContracts.includes(c);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discount Percentages (%)</CardTitle>
        <CardDescription>
          Tier d applies when a tenderer wins {tierCount} contracts in total:
          tier 1 prices a single win, tier 2 prices two wins, and so on.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-medium dark:bg-gray-900">
                  Tenderer
                </th>
                <th className="w-16 px-2 py-2 text-center font-medium">Tier</th>
                {Array.from({ length: contracts }).map((_, c) => (
                  <th
                    key={c}
                    className={`min-w-24 px-2 py-2 text-left font-medium ${!isSelected(c) ? "opacity-50" : ""}`}
                  >
                    {contractNames[c] || `C${c + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: tenderers }).map((_, t) => {
                const row = prices[t] ?? [];
                return Array.from({ length: tierCount }).map((_, dopIndex) => (
                  <tr key={`${t}-${dopIndex}`} className="border-b last:border-0">
                    {dopIndex === 0 && (
                      <td
                        className="sticky left-0 z-10 bg-white px-2 py-1.5 font-medium dark:bg-gray-900"
                        rowSpan={tierCount}
                      >
                        {tendererNames[t] || `T${t + 1}`}
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-center font-medium">
                      {dopIndex + 1}
                    </td>
                    {Array.from({ length: contracts }).map((_, c) => {
                      const disabled =
                        !isSelected(c) || !(row[c] > 0);
                      return (
                        <td
                          key={c}
                          className={`px-2 py-1.5 ${!isSelected(c) ? "opacity-50" : ""}`}
                        >
                          <MoneyInput
                            value={discounts[t]?.[c]?.[dopIndex] ?? 0}
                            max={100}
                            disabled={disabled}
                            onChange={(v) => onDiscountChange(t, c, dopIndex, v)}
                            className="w-20"
                            ariaLabel={`Discount tier ${dopIndex + 1} for ${tendererNames[t] || `T${t + 1}`} on ${contractNames[c] || `C${c + 1}`}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back to Prices
          </Button>
          <Button onClick={onCalculate} disabled={isCalculating}>
            {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
            Calculate Results
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
