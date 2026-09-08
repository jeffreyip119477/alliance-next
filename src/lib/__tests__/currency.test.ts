import { describe, expect, it } from "vitest";
import { parseMoney } from "../currency";

describe("parseMoney", () => {
  it("accepts common thousands and decimal separators", () => {
    expect(parseMoney("1,234.56")).toBe(1234.56);
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("1234,56")).toBe(1234.56);
    expect(parseMoney("1,234")).toBe(1234);
  });

  it("returns zero for empty or non-numeric input", () => {
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("not a number")).toBe(0);
  });
});
