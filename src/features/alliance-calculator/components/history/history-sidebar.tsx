"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Calculator, Clock, Trash2, X } from "lucide-react";
import type { HistoryItem } from "../../types";

export interface HistorySidebarProps {
  history: HistoryItem[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onClear: () => void;
}

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function ItemCard({
  item,
  onLoad,
  onDelete,
  onRename,
}: Pick<HistorySidebarProps, "onLoad" | "onDelete" | "onRename"> & {
  item: HistoryItem;
}) {
  const [name, setName] = useState(item.name);
  useEffect(() => setName(item.name), [item.name]);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== item.name) onRename(item.id, trimmed);
    else setName(item.name);
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-full rounded bg-transparent text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="History item name"
            />
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {item.source === "manual" ? "Manual" : "Random"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {item.snapshot?.contracts ?? 0} contracts
              </Badge>
              <Badge variant="outline" className="text-xs">
                {item.snapshot?.tenderers ?? 0} tenderers
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(item.savedAt)}
              </span>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                aria-label="Delete history item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete History Item</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this calculation from
                  history? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(item.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Button className="mt-3 w-full" size="sm" onClick={() => onLoad(item.id)}>
          Load This Calculation
        </Button>
      </CardContent>
    </Card>
  );
}

function HistoryList({
  history,
  onLoad,
  onDelete,
  onRename,
}: HistorySidebarProps) {
  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Calculator className="mx-auto mb-2 h-12 w-12 opacity-50" />
        <p>No calculation history yet</p>
        <p className="text-sm">
          Your manual and random calculations will appear here
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4 p-4">
      {history.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          onLoad={onLoad}
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  );
}

export default function HistorySidebar(props: HistorySidebarProps) {
  return (
    <div className="flex h-full w-full flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Clock className="h-5 w-5" />
          Calculation History
        </h2>
      </div>
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <HistoryList {...props} />
        </ScrollArea>
      </div>
      {props.history.length > 0 && (
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All History
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All History</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete all calculation history? This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={props.onClear}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

export function MobileHistoryDrawer({
  open,
  onClose,
  ...props
}: HistorySidebarProps & { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute right-0 top-0 flex h-full w-80 max-w-[85vw] flex-col border-l border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5" />
            History
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close history">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <HistoryList {...props} />
          </ScrollArea>
        </div>
        {props.history.length > 0 && (
          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All History</AlertDialogTitle>
                  <AlertDialogDescription>This removes every saved calculation from this browser.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={props.onClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Clear All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
}
