import type { ReactNode } from "react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Award,
  Trophy,
  FlaskConical,
  GitCompareArrows,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Ban,
  X,
} from "lucide-react";
import { computeWinStats } from "../../domain/analytics";
import type { Results } from "../../domain/alliance-combinations";
import type { ResultsView, WhatIf, WhatIfChange } from "../../types";
import {
  isSelectedIn,
  lowestBaseFor,
  lowestBasePrices,
  resultColumnFor,
} from "./selectors";

export {
  useEffect,
  useMemo,
  useRef,
  useState,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Switch,
  Label,
  Award,
  Trophy,
  FlaskConical,
  GitCompareArrows,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Ban,
  X,
  computeWinStats,
  isSelectedIn,
  lowestBaseFor,
  lowestBasePrices,
  resultColumnFor,
};

export type { ReactNode, Results, ResultsView, WhatIf, WhatIfChange };

export const varianceIndicator = (
  currentCost: number,
  lowestBasePrice: number,
  format: ResultsView["format"],
  showAbbreviated: boolean
): ReactNode => {
  const variance = Number((lowestBasePrice - currentCost).toFixed(2));
  if (variance > 0) {
    return (
      <div className="mt-0.5 text-[10px] font-bold text-emerald-500">
        Save: +{format(variance, showAbbreviated)}
      </div>
    );
  }
  if (variance < 0) {
    return (
      <div className="mt-0.5 text-[10px] font-medium text-red-500">
        Add: {format(Math.abs(variance), showAbbreviated)}
      </div>
    );
  }
  return (
    <div className="mt-0.5 text-[10px] text-muted-foreground">
      At Base Minimum
    </div>
  );
};
