"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Results } from "../domain/alliance-combinations";
import { downloadResultsPdf } from "../infrastructure/pdf";
import type { WhatIf } from "../types";

interface PdfExportDialogProps {
  results: Results | null;
  tendererNames: string[];
  contractNames: string[];
  whatIf: WhatIf | null;
  forced: (number | null)[];
  forbidden: boolean[][];
  selectedContracts: number[];
  children: (controls: { open: () => void; hasResults: boolean }) => ReactNode;
}

export function PdfExportDialog({
  results,
  tendererNames,
  contractNames,
  whatIf,
  forced,
  forbidden,
  selectedContracts,
  children,
}: PdfExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reportHeading, setReportHeading] = useState("Alliance decision summary");
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    if (results) setOpen(true);
  };

  const confirmExport = async () => {
    if (!results) return;
    try {
      setError(null);
      await downloadResultsPdf(results, {
        reportHeading: reportHeading.trim() || "Alliance decision summary",
        tendererNames,
        contractNames,
        whatIf: whatIf?.applied ? whatIf : undefined,
        forced,
        forbidden,
        selectedContracts,
      });
      setOpen(false);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : String(exportError));
    }
  };

  return (
    <>
      {children({ open: openDialog, hasResults: results !== null })}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export PDF report</AlertDialogTitle>
            <AlertDialogDescription>
              Choose the heading shown on the report cover.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            aria-label="PDF report heading"
            value={reportHeading}
            onChange={(event) => setReportHeading(event.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmExport();
              }}
            >
              Export PDF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && (
        <Alert className="mb-6 border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertTitle>PDF export failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
