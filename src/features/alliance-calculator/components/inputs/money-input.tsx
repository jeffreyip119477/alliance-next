"use client";

import { memo, useEffect, useRef, useState } from "react";
import { parseMoney } from "@/lib/currency";

export interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * Free-typing money/percent field: accepts "1,234.56", "1234,56", "1234",
 * rejects garbage, clamps to [min, max] and commits on blur/Enter.
 * Esc reverts to the prop value.
 */
export const MoneyInput = memo(function MoneyInput({
  value,
  onChange,
  min = 0,
  max,
  disabled,
  className,
  placeholder = "0",
  ariaLabel,
}: MoneyInputProps) {
  const [text, setText] = useState<string>(value ? String(value) : "");
  const editing = useRef(false);

  // Keep the field in sync with external changes (history load, random data).
  useEffect(() => {
    if (!editing.current) setText(value ? String(value) : "");
  }, [value]);

  const commit = () => {
    editing.current = false;
    let v = parseMoney(text);
    if (!Number.isFinite(v)) v = 0;
    v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    v = Number(v.toFixed(2));
    onChange(v);
    setText(v ? String(v) : "");
  };

  const cancel = () => {
    editing.current = false;
    setText(value ? String(value) : "");
  };

  const baseClasses =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors " +
    "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
    "disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`${baseClasses} ${className ?? ""}`}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        else if (e.key === "Escape") cancel();
      }}
    />
  );
});
