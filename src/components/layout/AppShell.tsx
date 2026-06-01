"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SiteLogo } from "@/components/layout/SiteLogo";
import { cn } from "@/lib/utils";
import { isBrregLive, isDemoMode } from "@/lib/demo/config";
import {
  Building2,
  CreditCard,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MoreHorizontal,
  Send,
  Shield,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/app/oversikt", label: "Oversikt", icon: LayoutDashboard, mobileTab: true },
  { href: "/app", label: "Skann", icon: Building2, mobileTab: true },
  { href: "/app/pipeline", label: "Pipeline", icon: GitBranch, mobileTab: true },
  { href: "/app/maler", label: "Maler", icon: Mail, mobileTab: true },
  { href: "/app/sekvenser", label: "Sekvenser", icon: Workflow, mobileTab: false },
  { href: "/app/kampanjer", label: "Kampanjer", icon: Send, mobileTab: false },
  { href: "/app/innstillinger", label: "E-post", icon: Mail, mobileTab: false },
  { href: "/app/abonnement", label: "Abonnement", icon: CreditCard, mobileTab: false },
];

const MOBILE_TABS = NAV.filter((n) => n.mobileTab);

export function AppShell({
  children,
  isAdmin = true,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const demo = isDemoMode();
  const brregLive = isBrregLive();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function logout() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/app") return pathname === "/app";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const navLinkClass = (href: string) =>
    cn("glass-nav-link", isActive(href) && "glass-nav-link-active");

  const sidebarContent = (
    <>
      <div className="px-4 py-6">
        <Link
          href="/app/oversikt"
          className="group block transition hover:opacity-90"
          onClick={() => setDrawerOpen(false)}
        >
          <SiteLogo className="h-9 w-auto max-w-full" />
          {demo && (
            <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-brand-gold">
              <Sparkles className="h-3 w-3" />
              Demo
            </p>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setDrawerOpen(false)}
            className={navLinkClass(href)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/admin"
            onClick={() => setDrawerOpen(false)}
            className={navLinkClass("/admin")}
          >
            <Shield className="h-4 w-4 shrink-0" />
            Admin
          </Link>
        )}
      </nav>

      <div className="border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={logout} className="glass-nav-link w-full">
          <LogOut className="h-4 w-4" />
          Logg ut
        </button>
      </div>
    </>
  );

  return (
    <div className="app-shell-bg flex min-h-screen">
      {(demo || brregLive) && (
        <div
          className={cn(
            "fixed inset-x-0 top-0 z-[60] border-b px-3 py-1.5 text-center text-[10px] font-medium backdrop-blur-xl sm:px-4 sm:py-2 sm:text-xs",
            brregLive && !demo
              ? "border-emerald-200/60 bg-emerald-50/80 text-emerald-800"
              : "border-amber-200/60 bg-amber-50/80 text-amber-900"
          )}
        >
          <Sparkles className="mr-1 inline h-3 w-3 sm:h-3.5 sm:w-3.5" />
          {brregLive && demo
            ? "Live firma fra Brønnøysund · maler er demo"
            : brregLive
              ? "Live data fra Brønnøysundregistrene"
              : "Demo-modus — ekte data kobles på senere"}
        </div>
      )}

      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-40 m-3 hidden w-60 flex-col rounded-2xl glass-sidebar lg:flex",
          (demo || brregLive) && "top-11 sm:top-12"
        )}
      >
        {sidebarContent}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute bottom-3 left-3 top-3 flex w-[min(100vw-1.5rem,288px)] flex-col rounded-2xl glass-sidebar">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Lukk meny"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div
        className={cn(
          "relative z-10 flex min-h-screen min-w-0 flex-1 flex-col lg:pl-[calc(15rem+1.5rem)]",
          (demo || brregLive) && "pt-8 sm:pt-9"
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/15 bg-brand-navy/35 px-4 backdrop-blur-xl lg:hidden">
          <Link href="/app/oversikt" className="flex items-center">
            <SiteLogo className="h-8 w-auto" />
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-xl border border-white/25 bg-white/15 p-2 text-white/80 backdrop-blur-md"
            aria-label="Meny"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="app-scroll relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-6">
          <div className="relative z-10 mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </div>
        </main>

        <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/25 bg-brand-navy/50 shadow-lg backdrop-blur-2xl lg:hidden">
          <div className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
            {MOBILE_TABS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition",
                  isActive(href) ? "text-white" : "text-white/50"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition",
                    isActive(href) && "bg-white/20 shadow-sm"
                  )}
                >
                  <Icon
                    className={cn("h-5 w-5", isActive(href) && "text-brand-gold")}
                    strokeWidth={isActive(href) ? 2.5 : 2}
                  />
                </span>
                <span className="text-[9px] font-semibold">{label}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition",
                drawerOpen ? "text-white" : "text-white/50"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl",
                  drawerOpen && "bg-white/20 shadow-sm"
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
              </span>
              <span className="text-[9px] font-semibold">Mer</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
