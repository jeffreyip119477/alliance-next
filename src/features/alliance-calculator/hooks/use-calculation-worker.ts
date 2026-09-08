"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type EngineOptions,
} from "../domain/alliance-combinations";
import type { Results } from "../domain/alliance-combinations";
import type { CalcRequest, CalcResponse } from "../workers/types";
import { calculateRequest } from "../workers/compute";
import { WORKER_TIMEOUT_MS } from "../constants";

export const useCalculationWorker = () => {
  const [results, setResults] = useState<Results | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestSeq = useRef(0);
  const lastInputKeyRef = useRef("");

  useEffect(() => {
    if (typeof Worker === "undefined") return;
    const worker = new Worker(
      new URL("../workers/calculator.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const compute = useCallback(
    (
      prices: number[][],
      discounts: number[][][],
      contractCount: number,
      tendererCount: number,
      averageDop: boolean,
      options: EngineOptions,
      key: string
    ) => {
      const id = ++requestSeq.current;
      lastInputKeyRef.current = key;
      setIsCalculating(true);
      setCalcError(null);

      const worker = workerRef.current;
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const clearTimeoutGuard = () => {
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }
      };

      const settle = (response: CalcResponse) => {
        if (settled || response.id !== id || id !== requestSeq.current) return;
        settled = true;
        clearTimeoutGuard();
        setIsCalculating(false);
        if ("error" in response) {
          setCalcError(response.error);
          setResults(null);
          return;
        }
        setResults(response.results);
      };

      const runSyncFallback = () => {
        if (settled || id !== requestSeq.current) return;
        settled = true;
        clearTimeoutGuard();
        if (worker && workerRef.current === worker) {
          worker.terminate();
          workerRef.current = null;
        }

        const response = calculateRequest({
          id,
          prices,
          discounts,
          cCount: contractCount,
          tCount: tendererCount,
          avgDop: averageDop,
          options,
        });
        if ("error" in response) {
          setCalcError(response.error);
          setResults(null);
          setIsCalculating(false);
        } else {
          setResults(response.results);
          setCalcError(null);
          setIsCalculating(false);
        }
      };

      if (!worker) {
        runSyncFallback();
        return;
      }

      worker.onmessage = (event: MessageEvent<CalcResponse>) =>
        settle(event.data);
      worker.onerror = runSyncFallback;
      worker.onmessageerror = runSyncFallback;

      const request: CalcRequest = {
        id,
        prices,
        discounts,
        cCount: contractCount,
        tCount: tendererCount,
        avgDop: averageDop,
        options,
      };

      try {
        worker.postMessage(request);
        timeout = setTimeout(runSyncFallback, WORKER_TIMEOUT_MS);
      } catch {
        runSyncFallback();
      }
    },
    []
  );

  const reset = useCallback(() => {
    setResults(null);
    setCalcError(null);
    setIsCalculating(false);
  }, []);

  return { results, isCalculating, calcError, compute, reset, lastInputKeyRef };
};
