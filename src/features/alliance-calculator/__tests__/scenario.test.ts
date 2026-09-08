import { describe, expect, it } from "vitest";
import { scenarioKey } from "../domain/scenario";

const prices = [
  [10, 20, 30],
  [15, 25, 35],
];
const discounts = [
  [[0, 1, 2], [0, 1, 2], [0, 1, 2]],
  [[0, 3, 4], [0, 3, 4], [0, 3, 4]],
];

describe("scenario keys", () => {
  it("treats an unordered selected-contract list as the same scenario", () => {
    const first = scenarioKey(prices, discounts, 3, 2, false, false, [0, 2], [], [], []);
    const second = scenarioKey(prices, discounts, 3, 2, false, false, [2, 0], [], [], []);
    expect(first).toBe(second);
  });

  it("changes when calculation options change", () => {
    const normal = scenarioKey(prices, discounts, 3, 2, false, false, [], [], [], []);
    const fast = scenarioKey(prices, discounts, 3, 2, false, true, [], [], [], []);
    expect(normal).not.toBe(fast);
  });
});
