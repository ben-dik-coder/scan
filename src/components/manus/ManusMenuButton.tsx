"use client";

import { cn } from "@/lib/utils";
import { ScrollText } from "lucide-react";

type Props = {
  className?: string;
  onOpen: () => void;
};

export function ManusMenuButton({ className, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("glass-nav-link w-full", className)}
    >
      <ScrollText className="h-4 w-4 shrink-0" />
      Manus
    </button>
  );
}
