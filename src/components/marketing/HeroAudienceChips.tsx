import { HERO_AUDIENCES } from "@/content/landing";
import { cn } from "@/lib/utils";

export function HeroAudienceChips({ className }: { className?: string }) {
  return (
    <div className={cn("hero-audience-chips", className)}>
      {HERO_AUDIENCES.map((label) => (
        <span key={label} className="hero-audience-chip">
          {label}
        </span>
      ))}
    </div>
  );
}
