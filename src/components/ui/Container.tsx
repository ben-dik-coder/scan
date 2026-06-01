import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
  wide,
}: {
  className?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8",
        wide ? "max-w-7xl" : "max-w-6xl",
        className
      )}
    >
      {children}
    </div>
  );
}
