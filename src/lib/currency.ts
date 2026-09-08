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

/**
 * Parse a money input string. Both `1,234.56` and `1.234,56` are accepted;
 * a lone comma followed by one or two digits is treated as a decimal comma,
 * while a three-digit group is treated as a thousands separator.
 */
export const parseMoney = (raw: string): number => {
  const source = String(raw ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!source) return 0;
  const sign = source.startsWith("-") ? "-" : "";
  const unsigned = source.replace(/^[+-]/, "");
  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalAt = Math.max(lastComma, lastDot);
    const integer = unsigned.slice(0, decimalAt).replace(/[.,]/g, "");
    const fraction = unsigned.slice(decimalAt + 1).replace(/[.,]/g, "");
    normalized = `${integer}.${fraction}`;
  } else if (lastComma >= 0) {
    const fraction = unsigned.slice(lastComma + 1);
    normalized = fraction.length > 0 && fraction.length <= 2
      ? `${unsigned.slice(0, lastComma).replace(/,/g, "")}.${fraction}`
      : unsigned.replace(/,/g, "");
  } else {
    normalized = unsigned;
  }
  const n = Number.parseFloat(sign + normalized);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};
