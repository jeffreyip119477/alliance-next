// Shared currency formatting + input parsing for the alliance tool.

export const formatMoney = (
  value: number | null | undefined,
  opts: { abbreviated?: boolean; decimals?: number } = {}
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return formatMoney(0, opts);
  }
  const { abbreviated = false, decimals = 2 } = opts;

  if (abbreviated) {
    const symbol = "$";
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${symbol}${(value / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${symbol}${(value / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${symbol}${(value / 1e3).toFixed(1)}K`;
  }

  return "$" + new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/** Parse a money input string (allows thousands commas, strips junk). */
export const parseMoney = (raw: string): number => {
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};
