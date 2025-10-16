"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, Clock, Calculator } from "lucide-react";
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

interface HistoryItem {
  id: string;
  timestamp: number;
  contracts: number;
  tenderers: number;
  totalLowestBase: number;
  totalSelectedDiscounted: number;
  costSaving: number;
  tendererNames: string[];
  selectedContracts: boolean[];
  prices: number[][];
  discounts: number[][][];
}

interface HistorySidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  onLoadHistory: (item: HistoryItem) => void;
  refreshHistory?: () => void;
}

const HistorySidebar = forwardRef<
  { refreshHistory: () => void },
  HistorySidebarProps
>(({ isOpen, onClose, onLoadHistory }, ref) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    loadHistory();

    // Listen for localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "alliance-calculator-history") {
        loadHistory();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem("alliance-calculator-history");
      if (saved) {
        const parsedHistory = JSON.parse(saved);
        setHistory(parsedHistory);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error("Error loading history:", error);
      setHistory([]);
    }
  };

  useImperativeHandle(ref, () => ({
    refreshHistory: loadHistory,
  }));

  const deleteHistoryItem = (id: string) => {
    try {
      const updatedHistory = history.filter((item) => item.id !== id);
      setHistory(updatedHistory);
      localStorage.setItem(
        "alliance-calculator-history",
        JSON.stringify(updatedHistory)
      );
    } catch (error) {
      console.error("Error deleting history item:", error);
    }
  };

  const clearAllHistory = () => {
    try {
      setHistory([]);
      localStorage.removeItem("alliance-calculator-history");
    } catch (error) {
      console.error("Error clearing history:", error);
    }
  };

  const formatCurrency = (value: number, abbreviate: boolean = true) => {
    if (value === undefined || value === null) {
      return "$0.00";
    }

    try {
      if (abbreviate) {
        // For very large amounts, use abbreviated notation
        if (value >= 1000000000) {
          // Billions
          return `$${(value / 1000000000).toFixed(2)}B`;
        } else if (value >= 1000000) {
          // Millions
          return `$${(value / 1000000).toFixed(2)}M`;
        } else if (value >= 1000) {
          // Thousands
          return `$${(value / 1000).toFixed(2)}K`;
        } else {
          return `$${value.toLocaleString()}`;
        }
      } else {
        // Full currency format
        return `$${value.toLocaleString()}`;
      }
    } catch (error) {
      console.error("Error formatting currency:", error, "Value:", value);
      return "$0.00";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg hidden lg:flex lg:flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Calculation History
        </h2>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {history.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No calculation history yet</p>
              <p className="text-sm">
                Your manual calculations will appear here
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {history.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-sm font-medium">
                          {formatDate(item.timestamp)}
                        </CardTitle>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {item.contracts} Contracts
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {item.tenderers} Tenderers
                          </Badge>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete History Item
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this calculation
                              from history? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteHistoryItem(item.id)}
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
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Base Total:
                        </span>
                        <span className="font-medium">
                          {formatCurrency(item.totalLowestBase, true)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Discounted Total:
                        </span>
                        <span className="font-medium">
                          {formatCurrency(item.totalSelectedDiscounted, true)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Savings:</span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(item.costSaving, true)}
                        </span>
                      </div>
                    </div>
                    <Button
                      className="w-full mt-3"
                      size="sm"
                      onClick={() => onLoadHistory(item)}
                    >
                      Load This Calculation
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {history.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
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
                  onClick={clearAllHistory}
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
});

HistorySidebar.displayName = "HistorySidebar";

export default HistorySidebar;
