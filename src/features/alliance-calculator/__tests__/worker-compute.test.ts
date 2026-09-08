import { describe, expect, it } from "vitest";
import { calculateRequest } from "../workers/compute";

describe("worker calculation adapter", () => {
  it("returns the request id and computed result for synchronous fallback", () => {
    const response = calculateRequest({
      id: 42,
      prices: [[100]],
      discounts: [[[0]]],
      cCount: 1,
      tCount: 1,
      avgDop: false,
      options: {},
    });

    expect(response.id).toBe(42);
    expect("results" in response && response.results.bestCombo?.total).toBe(100);
  });
});
