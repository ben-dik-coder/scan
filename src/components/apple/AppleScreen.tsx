import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  className?: string;
  toolbar?: ReactNode;
};

export function AppleScreen({ title, children, className, toolbar }: Props) {
  return (
    <div className={cn("apple-ui apple-screen flex flex-col", className)}>
      {(title || toolbar) && (
        <header className="border-b border-[var(--apple-separator)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {title ? <h1 className="text-xl font-bold">{title}</h1> : <span />}
            {toolbar}
          </div>
        </header>
      )}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
