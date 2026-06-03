import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  /** Trekker arket litt opp over forrige seksjon */
  overlap?: boolean;
  /** Legges under papirbrett — ingen negativ margin, lavere z-index */
  belowFold?: boolean;
  className?: string;
};

export function LandingSheet({
  children,
  overlap = true,
  belowFold = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "relative px-3 sm:px-5 lg:px-8",
        belowFold ? "landing-sheet-below-fold z-0" : "z-10",
        overlap && !belowFold && "landing-sheet-overlap",
        className
      )}
    >
      <div className="landing-sheet mx-auto w-full max-w-6xl xl:max-w-7xl">{children}</div>
    </div>
  );
}
