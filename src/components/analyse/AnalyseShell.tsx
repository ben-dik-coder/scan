"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ANALYSE_NAV, analyseNavItem } from "@/lib/analyse/nav";
import { cn } from "@/lib/utils";

export function AnalyseShell({
  children,
  generatedAt,
}: {
  children: React.ReactNode;
  generatedAt?: string;
}) {
  const pathname = usePathname();
  const current = analyseNavItem(pathname);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Analyse
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {current.label}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              {current.description}
            </p>
          </div>
          {generatedAt ? (
            <p className="text-[11px] tabular-nums text-zinc-600">
              Oppdatert{" "}
              {new Date(generatedAt).toLocaleString("nb-NO", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>

        <nav
          className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Analyse-undermenyer"
        >
          {ANALYSE_NAV.map((item) => {
            const active =
              item.href === "/app/analyse"
                ? pathname === "/app/analyse"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "border-white/20 bg-white text-black"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {children}
    </div>
  );
}
