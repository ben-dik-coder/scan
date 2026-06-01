"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#funksjoner", label: "Funksjoner" },
  { href: "#slik-funker-det", label: "Slik funker det" },
  { href: "#pris", label: "Pris" },
];

export function SiteHeader({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-brand-navy/95 backdrop-blur-md",
          className
        )}
      >
        <Container wide className="flex h-14 items-center justify-between sm:h-[72px]">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-gold font-display text-sm font-black text-brand-navy transition group-hover:brightness-110 sm:h-10 sm:w-10 sm:text-base">
              N
            </span>
            <span className="truncate font-display text-lg font-black uppercase tracking-wide text-white sm:text-xl">
              {site.name}
            </span>
          </Link>

          <nav className="hidden items-center gap-8 lg:gap-10 md:flex">
            {LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="font-display text-xs font-bold uppercase tracking-athletic text-white/50 transition hover:text-brand-goldLight"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/innlogging"
              className="hidden font-display text-xs font-bold uppercase tracking-athletic text-white/50 transition hover:text-white md:inline"
            >
              Logg inn
            </Link>
            <Link
              href="/app/oversikt"
              className="btn-primary !px-4 !py-2.5 !text-[10px] sm:!px-5 sm:!py-3 sm:!text-xs"
            >
              Demo
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md p-2.5 text-white/70 transition hover:bg-white/10 md:hidden"
              aria-label="Åpne meny"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </Container>
      </header>

      {/* Mobil meny */}
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(100vw,320px)] flex-col bg-brand-navy shadow-lift">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <span className="font-display text-sm font-black uppercase tracking-wide text-white">
                Meny
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-white/60 hover:bg-white/10"
                aria-label="Lukk meny"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 p-4">
              {LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-4 py-3.5 font-display text-sm font-bold uppercase tracking-athletic text-white/70 transition hover:bg-white/5 hover:text-brand-goldLight"
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="space-y-2 border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Link
                href="/innlogging"
                onClick={() => setOpen(false)}
                className="block rounded-md border border-white/20 px-4 py-3.5 text-center font-display text-xs font-bold uppercase tracking-athletic text-white"
              >
                Logg inn
              </Link>
              <Link
                href="/app/oversikt"
                onClick={() => setOpen(false)}
                className="btn-primary w-full"
              >
                Prøv demo
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
