import Image from "next/image";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Mørk bakgrunn — hvit «Ny», grønn «Lead» */
export const SITE_LOGO_DARK_SRC = "/images/logo/logo-dark.png";
/** Lys bakgrunn — navy «Ny», grønn «Lead» */
export const SITE_LOGO_LIGHT_SRC = "/images/logo/logo-light.png";

/** @deprecated Bruk SITE_LOGO_DARK_SRC eller SITE_LOGO_LIGHT_SRC */
export const SITE_LOGO_SRC = SITE_LOGO_DARK_SRC;

type Props = {
  className?: string;
  priority?: boolean;
  /** Logo på hvit/lys header */
  onLight?: boolean;
  variant?: "light" | "dark";
};

export function SiteLogo({
  className,
  priority = false,
  onLight = false,
  variant,
}: Props) {
  const useLight = variant === "light" || (variant !== "dark" && onLight);
  const src = useLight ? SITE_LOGO_LIGHT_SRC : SITE_LOGO_DARK_SRC;

  return (
    <Image
      src={src}
      alt={site.name}
      width={793}
      height={286}
      priority={priority}
      className={cn("app-shell-logo-img h-9 w-auto sm:h-10", className)}
      style={{ height: "2.25rem", width: "auto", maxWidth: "11rem" }}
    />
  );
}
