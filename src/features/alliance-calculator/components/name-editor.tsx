"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface NameEditorProps {
  count: number;
  names: string[];
  setNames: (names: string[]) => void;
  label: string;
  prefix: string;
}

export function NameEditor({
  count,
  names,
  setNames,
  label,
  prefix,
}: NameEditorProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-1">
          <Label
            htmlFor={`${prefix}-${index}`}
            className="text-xs text-muted-foreground"
          >
            {prefix} {index + 1}
          </Label>
          <Input
            id={`${prefix}-${index}`}
            value={names[index] ?? ""}
            placeholder={`${label} ${index + 1}`}
            onChange={(event) =>
              setNames(
                names.map((name, nameIndex) =>
                  nameIndex === index ? event.target.value : name
                )
              )
            }
            suppressHydrationWarning
          />
        </div>
      ))}
    </div>
  );
}
