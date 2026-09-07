"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ban, Pin, Trash2 } from "lucide-react";

export interface ConstraintsPanelProps {
  tenderers: number;
  contracts: number;
  prices: number[][];
  tendererNames: string[];
  contractNames: string[];
  selectedContracts: number[];
  forced: (number | null)[];
  forbidden: boolean[][];
  maxWins: number[];
  setForced: (f: (number | null)[]) => void;
  setForbidden: (fb: boolean[][]) => void;
  setMaxWins: (mw: number[]) => void;
}

/**
 * Optional constraints:
 *  - Force a tenderer to win a contract (cycling: free → forced → forbidden)
 *  - Forbid a tenderer from winning a contract
 *  - Cap how many contracts each tenderer may win (0 = unlimited)
 */
export function ConstraintsPanel({
  tenderers,
  contracts,
  prices,
  tendererNames,
  contractNames,
  selectedContracts,
  forced,
  forbidden,
  maxWins,
  setForced,
  setForbidden,
  setMaxWins,
}: ConstraintsPanelProps) {
  const isSelected = (c: number) =>
    selectedContracts.length === 0 || selectedContracts.includes(c);
  const tierCount = selectedContracts.length || contracts;

  const cellState = (t: number, c: number): "free" | "forced" | "forbidden" => {
    if (forbidden[t]?.[c]) return "forbidden";
    if (forced[c] === t) return "forced";
    return "free";
  };

  const cycleCell = (t: number, c: number) => {
    const state = cellState(t, c);
    // Always build arrays sized to the current grid, so state changes persist
    // even when the constraint arrays were empty or previously shorter.
    const f = Array.from({ length: contracts }, (_, i) => forced[i] ?? null);
    const fb = Array.from({ length: tenderers }, (_, rt) =>
      Array.from({ length: contracts }, (_, rc) => forbidden[rt]?.[rc] ?? false)
    );
    if (state === "free") {
      f[c] = t;
      setForced(f);
    } else if (state === "forced") {
      if (f[c] === t) f[c] = null;
      fb[t][c] = true;
      setForced(f);
      setForbidden(fb);
    } else {
      fb[t][c] = false;
      setForbidden(fb);
    }
  };

  const hasAny =
    forced.some((v) => v !== null && v !== undefined) ||
    forbidden.some((row) => row.some(Boolean)) ||
    maxWins.some((v) => v > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Constraints</CardTitle>
          <CardDescription>
            Optional: pin or block awards, and cap wins per tenderer.
          </CardDescription>
        </div>
        {hasAny && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setForced([]);
              setForbidden([]);
              setMaxWins([]);
            }}
          >
            <Trash2 className="h-4 w-4" /> Clear all
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
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
                    className={`min-w-20 px-2 py-2 text-left font-medium ${!isSelected(c) ? "opacity-50" : ""}`}
                  >
                    {contractNames[c] || `C${c + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: tenderers }).map((_, t) => {
                const row = prices[t] ?? [];
                return (
                  <tr key={t} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5 font-medium dark:bg-gray-900">
                      {tendererNames[t] || `T${t + 1}`}
                    </td>
                    {Array.from({ length: contracts }).map((_, c) => {
                      const state = cellState(t, c);
                      const enabled = isSelected(c) && row[c] > 0;
                      return (
                        <td key={c} className={`px-2 py-1.5 ${!isSelected(c) ? "opacity-50" : ""}`}>
                          <button
                            type="button"
                            disabled={!enabled}
                            title={
                              state === "free"
                                ? "Click to force this tenderer to win the contract"
                                : state === "forced"
                                  ? "Forced — click to forbid instead"
                                  : "Forbidden — click to free"
                            }
                            onClick={() => cycleCell(t, c)}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              state === "forced"
                                ? "border-[#00B2CA] bg-[#00B2CA]/20 text-[#00B2CA]"
                                : state === "forbidden"
                                  ? "border-red-400 bg-red-500/20 text-red-500"
                                  : "border-input hover:bg-muted"
                            }`}
                          >
                            {state === "forced" ? (
                              <Pin className="h-3.5 w-3.5" />
                            ) : state === "forbidden" ? (
                              <Ban className="h-3.5 w-3.5" />
                            ) : (
                              "·"
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Maximum contracts per tenderer{" "}
            <span className="text-xs text-muted-foreground">
              (0 = unlimited; cap applies per scenario of {tierCount} contracts)
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {Array.from({ length: tenderers }).map((_, t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <span className="w-16 truncate">{tendererNames[t] || `T${t + 1}`}</span>
                <input
                  type="number"
                  min={0}
                  max={tierCount}
                  value={maxWins[t] ?? 0}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const clamped = Number.isFinite(v)
                      ? Math.max(0, Math.min(tierCount, Math.floor(v)))
                      : 0;
                    const mw = Array.from({ length: tenderers }, (_, i) => maxWins[i] ?? 0);
                    mw[t] = clamped;
                    setMaxWins(mw);
                  }}
                  className="h-8 w-14 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label={`Maximum wins for ${tendererNames[t] || `T${t + 1}`}`}
                />
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
