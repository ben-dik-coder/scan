import Image from "next/image";
import { HERO_CALLOUTS } from "@/content/landing";
import { cn } from "@/lib/utils";

export const HERO_PREVIEW_SRC = "/images/front/front.png";

const CALLOUT_VARIANTS: Record<
  (typeof HERO_CALLOUTS)[number]["variant"],
  string
> = {
  emerald: "hero-callout--emerald",
  sky: "hero-callout--sky",
  violet: "hero-callout--violet",
  slate: "hero-callout--slate",
};

export function HeroPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative w-full max-w-none", className)}>
      <div className="hero-preview-frame relative w-full overflow-hidden rounded-2xl border border-brand-border bg-white pt-0 pb-0 shadow-premium lg:rounded-3xl">
        <Image
          src={HERO_PREVIEW_SRC}
          alt="Forhåndsvisning av NyLead — nye firma med kontaktinfo, nettside-sjekk og send fra din e-post"
          width={1991}
          height={790}
          priority
          className="block h-auto w-full min-w-full object-contain pt-0 pb-0"
          sizes="(max-width: 1024px) 100vw, 58vw"
        />
        <div className="hero-callouts pointer-events-none absolute inset-0 hidden sm:block">
          {HERO_CALLOUTS.map((callout) => (
            <span
              key={callout.text}
              className={cn(
                "hero-callout",
                CALLOUT_VARIANTS[callout.variant],
                callout.className
              )}
            >
              {callout.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
