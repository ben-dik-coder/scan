import Image from "next/image";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export const SITE_LOGO_SRC = "/images/logo/logo.png";

type Props = {
  className?: string;
  priority?: boolean;
};

export function SiteLogo({ className, priority = false }: Props) {
  return (
    <Image
      src={SITE_LOGO_SRC}
      alt={site.name}
      width={1536}
      height={1024}
      priority={priority}
      className={cn("h-9 w-auto sm:h-10", className)}
    />
  );
}
