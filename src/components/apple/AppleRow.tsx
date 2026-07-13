import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  showChevron?: boolean;
  className?: string;
};

export function AppleRow({
  title,
  subtitle,
  onClick,
  trailing,
  showChevron = Boolean(onClick),
  className,
}: Props) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("apple-row", className)}
    >
      <div className="min-w-0 flex-1">
        <div className="apple-row-title truncate">{title}</div>
        {subtitle ? <div className="apple-row-subtitle truncate">{subtitle}</div> : null}
      </div>
      {trailing}
      {showChevron && onClick ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--apple-label-tertiary)]" />
      ) : null}
    </Comp>
  );
}
