"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SiteLogo } from "@/components/layout/SiteLogo";
import { SubscriberCapBanner } from "@/components/marketing/SubscriberCapBanner";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#plattform", label: "Hva du får" },
  { href: "#slik-funker-det", label: "Slik funker det" },
  { href: "#pris", label: "Pris" },
  { href: "#faq", label: "FAQ" },
] as const;

export function SiteHeader({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 overflow-visible border-b border-white/10 bg-app-ink",
          className
        )}
      >
        <Container wide className="flex h-14 items-center justify-between overflow-visible sm:h-[72px]">
          <Link
            href="/"
            className="relative z-10 flex shrink-0 items-center transition hover:opacity-90"
          >
            <SiteLogo
              priority
              variant="dark"
              className="h-8 w-auto origin-left sm:h-9"
            />
          </Link>

          <nav className="hidden items-center gap-8 md:flex lg:gap-10">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="font-sans text-sm font-semibold text-white/80 transition hover:text-app-accentLight"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/registrer"
              className="hidden font-sans text-sm font-semibold text-white/80 transition hover:text-app-accentLight md:inline"
            >
              Registrer
            </Link>
            <Link
              href="/innlogging"
              className="btn-primary hidden !px-4 !py-2.5 !text-[10px] md:inline-flex sm:!px-5 sm:!py-3 sm:!text-xs"
            >
              Logg inn
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md p-2.5 text-white/80 transition hover:bg-white/10 md:hidden"
              aria-label="Åpne meny"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </Container>
        <SubscriberCapBanner variant="glass" />
      </header>

      {/* Mobil meny */}
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(100vw,320px)] flex-col bg-app-ink shadow-lift">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <span className="font-display text-sm font-black uppercase tracking-wide text-white">
                Meny
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Lukk meny"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              {NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-4 py-3.5 font-sans text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-app-accentLight"
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="space-y-2 border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Link
                href="/registrer"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[10px] border-2 border-white/20 bg-transparent px-8 py-4 font-sans text-sm font-semibold text-white transition hover:border-app-accent/40 hover:text-app-accentLight"
              >
                Registrer
              </Link>
              <Link
                href="/innlogging"
                onClick={() => setOpen(false)}
                className="btn-primary w-full"
              >
                Logg inn
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
