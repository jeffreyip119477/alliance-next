"use client";

import { Button } from "@/components/ui/button";
import { Database, FileText, History as HistoryIcon, Plus } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export interface CalculatorHeaderProps {
  hasResults: boolean;
  onExportPdf: () => void;
  onLoadShowcase: () => void;
  onNewCalculation: () => void;
  onOpenHistory: () => void;
}

export function CalculatorHeader({
  hasResults,
  onExportPdf,
  onLoadShowcase,
  onNewCalculation,
  onOpenHistory,
}: CalculatorHeaderProps) {
  return (
    <header className="mb-8 flex flex-row items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">Alliance Combinations Calculator</h1>
        <p className="text-sm text-muted-foreground">v4.0.0</p>
      </div>
      <div className="flex items-center gap-2">
        {hasResults && (
          <Button variant="outline" onClick={onExportPdf}>
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onLoadShowcase}
          title="Load and calculate the built-in six-contract showcase"
        >
          <Database className="h-4 w-4" /> Showcase
        </Button>
        <Button variant="outline" onClick={onNewCalculation}>
          <Plus className="h-4 w-4" /> New
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenHistory}
          aria-label="Open calculation history"
        >
          <HistoryIcon className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
