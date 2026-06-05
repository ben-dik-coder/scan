import { ArrowRight } from "lucide-react";
import { HERO_STEPS } from "@/content/landing";
import { cn } from "@/lib/utils";

export function HeroValueStrip({ className }: { className?: string }) {
  return (
    <div className={cn("hero-value-strip", className)}>
      <ol className="hero-value-strip__list">
        {HERO_STEPS.map((item, index) => {
          const Icon = item.icon;
          return (
            <li key={item.step} className="hero-value-strip__item">
              <div className="hero-value-strip__card">
                <span className="hero-value-strip__step" aria-hidden>
                  {item.step}
                </span>
                <Icon className="hero-value-strip__icon" aria-hidden />
                <div className="min-w-0">
                  <p className="hero-value-strip__label">{item.label}</p>
                  <p className="hero-value-strip__detail">{item.detail}</p>
                </div>
              </div>
              {index < HERO_STEPS.length - 1 && (
                <ArrowRight
                  className="hero-value-strip__arrow hidden sm:block"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
