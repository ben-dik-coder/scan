import { cn } from "@/lib/utils";
import { HeroPreview3D } from "@/components/marketing/HeroPreview3D";

export const HERO_PREVIEW_SRC = "/images/front/front.png";

export function HeroPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative w-full overflow-x-auto overflow-y-visible sm:overflow-visible", className)}>
      <div className="relative mx-auto w-full max-w-[900px] sm:max-w-[960px] lg:mx-0 lg:max-w-none">
        <HeroPreview3D className="w-full" />
      </div>
    </div>
  );
}
