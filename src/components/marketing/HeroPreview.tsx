import Image from "next/image";
import { cn } from "@/lib/utils";

export const HERO_PREVIEW_SRC = "/images/front/front.png";

export function HeroPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative w-full max-w-none", className)}>
      <div className="relative w-full overflow-hidden rounded-2xl border border-brand-border bg-white pt-0 pb-0 shadow-premium lg:rounded-3xl">
        <Image
          src={HERO_PREVIEW_SRC}
          alt="Forhåndsvisning av NyLead — finn firma uten nettside og send tilbud fra din egen e-post"
          width={1991}
          height={790}
          priority
          className="block h-auto w-full min-w-full object-contain pt-0 pb-0"
          sizes="(max-width: 1024px) 100vw, 58vw"
        />
      </div>
    </div>
  );
}
