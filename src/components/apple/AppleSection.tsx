import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function AppleSection({ title, children, className }: Props) {
  return (
    <section className={cn("apple-section", className)}>
      {title ? <div className="apple-section-header">{title}</div> : null}
      <div>{children}</div>
    </section>
  );
}
