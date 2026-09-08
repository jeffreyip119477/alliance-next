import { describe, expect, it } from "vitest";
import { generateRandomData } from "../domain/random-data";

describe("random grid generation", () => {
  it("creates the requested dimensions and ranges", () => {
    const values = [0, 0.5, 0.9999];
    let index = 0;
    const grid = generateRandomData(3, 2, 100, 200, 20, () => values[index++ % values.length]);

    expect(grid.prices).toHaveLength(2);
    expect(grid.prices.every((row) => row.length === 3)).toBe(true);
    expect(grid.discounts).toHaveLength(2);
    expect(grid.discounts.flat().every((ladder) => ladder.length === 3)).toBe(true);
    expect(grid.prices.flat().every((price) => price >= 100 && price <= 200)).toBe(true);
    expect(grid.discounts.flat().flat().every((discount) => discount >= 0 && discount <= 20)).toBe(true);
  });

  it("keeps the first discount tier at zero", () => {
    const grid = generateRandomData(4, 1, 1, 1, 100, () => 0.75);
    expect(grid.discounts[0].every((ladder) => ladder[0] === 0)).toBe(true);
  });
});
