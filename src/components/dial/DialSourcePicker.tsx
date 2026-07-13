"use client";

import { AppleSegmented } from "@/components/apple";
import type { DialSourceMode } from "@/hooks/useDialSession";

type Props = {
  mode: DialSourceMode;
  onChange: (mode: DialSourceMode) => void;
  listName?: string | null;
};

export function DialSourcePicker({ mode, onChange, listName }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <AppleSegmented
        value={mode}
        options={[
          { id: "queue", label: "Fra kø" },
          { id: "list", label: "Fra liste" },
        ]}
        onChange={onChange}
      />
      {mode === "list" && listName ? (
        <p className="text-xs text-[var(--apple-label-secondary)]">Liste: {listName}</p>
      ) : null}
    </div>
  );
}
