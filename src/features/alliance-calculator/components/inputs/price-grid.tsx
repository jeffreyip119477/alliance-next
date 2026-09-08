"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "./money-input";

export interface PriceGridProps {
  prices: number[][];
  tenderers: number;
  contracts: number;
  tendererNames: string[];
  contractNames: string[];
  selectedContracts: number[];
  showAbbreviated: boolean;
  format: (value: number, abbreviated?: boolean) => string;
  onPriceChange: (t: number, c: number, value: number) => void;
  onContinue: () => void;
}

export function PriceGrid({
  prices,
  tenderers,
  contracts,
  tendererNames,
  contractNames,
  selectedContracts,
  showAbbreviated,
  format,
  onPriceChange,
  onContinue,
}: PriceGridProps) {
  const isSelected = (c: number) =>
    selectedContracts.length === 0 || selectedContracts.includes(c);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base Prices</CardTitle>
        <CardDescription>
          Enter the base price each tenderer offers for each contract. Dashed
          contracts are excluded from the calculation.
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
                {Array.from({ length: contracts }).map((_, c) => (
                  <th
                    key={c}
                    className={`min-w-28 px-2 py-2 text-left font-medium ${!isSelected(c) ? "opacity-50" : ""}`}
                  >
                    {contractNames[c] || `C${c + 1}`}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: tenderers }).map((_, t) => {
                const row = prices[t] ?? [];
                const total = row.reduce(
                  (sum, p, c) => (isSelected(c) ? sum + (p || 0) : sum),
                  0
                );
                return (
                  <tr key={t} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5 font-medium dark:bg-gray-900">
                      {tendererNames[t] || `T${t + 1}`}
                    </td>
                    {Array.from({ length: contracts }).map((_, c) => (
                      <td
                        key={c}
                        className={`px-2 py-1.5 ${!isSelected(c) ? "opacity-50" : ""}`}
                      >
                        <MoneyInput
                          value={row[c] ?? 0}
                          onChange={(v) => onPriceChange(t, c, v)}
                          disabled={!isSelected(c)}
                          placeholder=""
                          className="w-28"
                          ariaLabel={`Price for ${tendererNames[t] || `T${t + 1}`} on ${contractNames[c] || `C${c + 1}`}`}
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-bold">
                      {format(total, showAbbreviated)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={onContinue}>Continue to Discounts</Button>
        </div>
      </CardContent>
    </Card>
  );
}
