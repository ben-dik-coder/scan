import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
  primaryHref?: string;
  primaryLabel?: string;
};

/** Simple enterprise placeholder for new sidebar destinations. */
export function AppPlaceholderPage({
  title,
  description,
  icon: Icon,
  primaryHref = "/app/oversikt",
  primaryLabel = "Til oversikt",
}: Props) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-start justify-center px-6 py-16">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <Icon className="h-5 w-5 text-zinc-200" aria-hidden />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-lg text-base leading-relaxed text-zinc-400">
        {description}
      </p>
      <Link
        href={primaryHref}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
      >
        {primaryLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
