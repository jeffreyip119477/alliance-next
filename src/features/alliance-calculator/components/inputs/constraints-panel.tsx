"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ban, ChevronDown, CircleSlash2, Minus, Pin, Plus, Trash2 } from "lucide-react";

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
  const [collapsed, setCollapsed] = useState(true);

  const isSelected = (c: number) =>
    selectedContracts.length === 0 || selectedContracts.includes(c);
  const tierCount = selectedContracts.length || contracts;

  const cellState = (t: number, c: number): "free" | "forced" | "forbidden" => {
    if (forbidden[t]?.[c]) return "forbidden";
    if (forced[c] === t) return "forced";
    return "free";
  };

  const setCellState = (t: number, c: number, next: "free" | "forced" | "forbidden") => {
    const f = Array.from({ length: contracts }, (_, i) => forced[i] ?? null);
    const fb = Array.from({ length: tenderers }, (_, rt) =>
      Array.from({ length: contracts }, (_, rc) => forbidden[rt]?.[rc] ?? false)
    );
    if (next === "forced") {
      f[c] = t;
      fb[t][c] = false;
    } else if (next === "forbidden") {
      if (f[c] === t) f[c] = null;
      fb[t][c] = true;
    } else {
      if (f[c] === t) f[c] = null;
      fb[t][c] = false;
    }
    setForced(f);
    setForbidden(fb);
  };

  const hasAny =
    forced.some((v) => v !== null && v !== undefined) ||
    forbidden.some((row) => row.some(Boolean)) ||
    maxWins.some((v) => v > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
            aria-expanded={!collapsed}
          >
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
            <CardTitle>Constraints</CardTitle>
          </button>
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
      {!collapsed && (
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Award rules</span>
          <span className="inline-flex items-center gap-1.5"><Pin className="h-3.5 w-3.5 text-[#00B2CA]" /> Pin award</span>
          <span className="inline-flex items-center gap-1.5"><Ban className="h-3.5 w-3.5 text-red-500" /> Block award</span>
          <span>Choose a state directly in each eligible cell.</span>
        </div>
        <div className="overflow-x-auto rounded-md border">
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
                        <td key={c} className={`px-2 py-2 ${!isSelected(c) ? "opacity-50" : ""}`}>
                          <div className="inline-flex rounded-md border bg-background p-0.5 shadow-sm">
                            {[
                              { value: "free", label: "No rule", icon: CircleSlash2, active: "bg-muted text-foreground" },
                              { value: "forced", label: "Pin award", icon: Pin, active: "bg-[#00B2CA]/15 text-[#008da2]" },
                              { value: "forbidden", label: "Block award", icon: Ban, active: "bg-red-500/15 text-red-600" },
                            ].map(({ value, label, icon: Icon, active }) => (
                              <button
                                key={value}
                                type="button"
                                disabled={!enabled}
                                title={label}
                                aria-label={`${label} for ${tendererNames[t] || `T${t + 1}`} on ${contractNames[c] || `C${c + 1}`}`}
                                aria-pressed={state === value}
                                onClick={() => setCellState(t, c, value as "free" | "forced" | "forbidden")}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${state === value ? active : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 border-t pt-5">
          <div>
            <p className="text-sm font-medium">Maximum awards</p>
            <p className="text-xs text-muted-foreground">Set a per-tenderer cap. Unlimited is the default; the highest useful cap is {tierCount}.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {Array.from({ length: tenderers }).map((_, t) => {
              const cap = maxWins[t] ?? 0;
              const setCap = (value: number) => {
                const mw = Array.from({ length: tenderers }, (_, i) => maxWins[i] ?? 0);
                mw[t] = Math.max(0, Math.min(tierCount, Math.floor(value)));
                setMaxWins(mw);
              };
              return (
              <div key={t} className="rounded-md border bg-background p-2">
                <span className="mb-2 block truncate text-xs font-medium">{tendererNames[t] || `T${t + 1}`}</span>
                <div className="flex items-center justify-between gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCap(Math.max(0, cap - 1))} disabled={cap === 0} aria-label={`Lower maximum wins for ${tendererNames[t] || `T${t + 1}`}`}><Minus className="h-3.5 w-3.5" /></Button>
                <input
                  type="number"
                  min={0}
                  max={tierCount}
                  value={cap}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setCap(Number.isFinite(v) ? v : 0);
                  }}
                  className="h-7 w-10 rounded border border-input bg-transparent px-1 text-center text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label={`Maximum wins for ${tendererNames[t] || `T${t + 1}`}`}
                />
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCap(cap + 1)} disabled={cap >= tierCount} aria-label={`Raise maximum wins for ${tendererNames[t] || `T${t + 1}`}`}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
                <span className="mt-1 block text-center text-[10px] text-muted-foreground">{cap === 0 ? "Unlimited" : `${cap} award${cap === 1 ? "" : "s"}`}</span>
              </div>
              );
            })}
          </div>
        </div>
      </CardContent>
      )}
    </Card>
  );
}
