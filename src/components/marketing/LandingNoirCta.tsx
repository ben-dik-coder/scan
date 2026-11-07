import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function LandingNoirCta({
  href = "/app",
  children,
  variant = "primary",
  className,
}: {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "accent";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "landing-noir-btn inline-flex items-center justify-center gap-2",
        variant === "primary" && "landing-noir-btn--primary",
        variant === "ghost" && "landing-noir-btn--ghost",
        variant === "accent" && "landing-noir-btn--accent",
        className
      )}
    >
      {children}
      {variant !== "ghost" ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
    </Link>
  );
}

export function LandingNoirBand({
  title,
  body,
  primaryHref = "/app",
  primaryLabel = "Åpne Skann",
  secondaryHref = "/registrer",
  secondaryLabel = "Opprett gratis konto",
}: {
  title: string;
  body: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="landing-noir-band">
      <div className="landing-noir-band-inner">
        <div className="landing-noir-band-glow" aria-hidden />
        <h2 className="landing-noir-h2 relative max-w-2xl">{title}</h2>
        <p className="relative mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
          {body}
        </p>
        <div className="relative mt-8 flex flex-wrap gap-3">
          <LandingNoirCta href={primaryHref}>{primaryLabel}</LandingNoirCta>
          <LandingNoirCta href={secondaryHref} variant="ghost">
            {secondaryLabel}
          </LandingNoirCta>
        </div>
      </div>
    </section>
  );
}
