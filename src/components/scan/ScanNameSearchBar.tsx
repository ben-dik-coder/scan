"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

type Props = {
  value: string;
  onDebouncedChange: (nameQuery: string) => void;
};

function DebouncedInput({
  value,
  onDebouncedChange,
}: {
  value: string;
  onDebouncedChange: (nameQuery: string) => void;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (local !== value) {
        onDebouncedChange(local);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [local, value, onDebouncedChange]);

  return (
    <input
      type="search"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      placeholder="Skriv f.eks. nails, spa, frisør…"
      className="scan-input min-h-[40px] w-full min-w-0 flex-1 text-sm"
      autoComplete="off"
      spellCheck={false}
    />
  );
}

export function ScanNameSearchBar({ value, onDebouncedChange }: Props) {
  return (
    <div className="scan-glass-divider border-b px-2.5 py-2.5 lg:px-3">
      <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="scan-label inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold">
          <Search className="h-4 w-4 text-brand-gold" />
          Søk i firmanavn
        </span>
        <DebouncedInput value={value} onDebouncedChange={onDebouncedChange} />
      </label>
      <p className="scan-glass-muted mt-1.5 text-[10px] leading-snug sm:pl-[calc(1rem+1.25rem+0.375rem)]">
        Skriv et ord — du får alle firma som har det i navnet. Kombiner gjerne med område til venstre.
      </p>
    </div>
  );
}
