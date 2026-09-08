import { generateResults } from "../domain/alliance-combinations";
import type { CalcRequest, CalcResponse } from "./types";

export const calculateRequest = (request: CalcRequest): CalcResponse => {
  try {
    const results = generateResults(
      request.prices,
      request.discounts,
      request.cCount,
      request.tCount,
      request.avgDop,
      request.options
    );
    return { id: request.id, results, elapsedMs: results.stats.elapsedMs };
  } catch (error) {
    return {
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
