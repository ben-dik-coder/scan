"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SiteLogo } from "@/components/layout/SiteLogo";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo/config";
import {
  Building2,
  CreditCard,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Mail,
  Menu,
  Send,
  Shield,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/app/oversikt", label: "Oversikt", icon: LayoutDashboard },
  { href: "/app/ko", label: "Arbeidskø", icon: ListTodo },
  { href: "/app", label: "Skann", icon: Building2 },
  { href: "/app/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/app/maler", label: "Maler", icon: Mail },
  { href: "/app/sekvenser", label: "Sekvenser", icon: Workflow },
  { href: "/app/kampanjer", label: "Kampanjer", icon: Send },
  { href: "/app/innstillinger", label: "E-post", icon: Mail },
  { href: "/app/abonnement", label: "Abonnement", icon: CreditCard },
];

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isScanPage = pathname === "/app";

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
      {demo && (
        <div className="px-4 pb-1 pt-4">
          <p className="flex items-center gap-1 text-xs font-semibold text-brand-gold">
            <Sparkles className="h-3.5 w-3.5" />
            Demo
          </p>
        </div>
      )}

      <nav
        className={cn(
          "flex-1 space-y-1 overflow-y-auto px-3",
          demo ? "pt-2" : "pt-4"
        )}
      >
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

      <div className="border-t border-brand-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={logout} className="glass-nav-link w-full">
          <LogOut className="h-4 w-4" />
          Logg ut
        </button>
      </div>
    </>
  );

  return (
    <div className="app-shell-bg flex min-h-screen text-brand-navy">
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute bottom-3 left-3 top-3 flex w-[min(100vw-1.5rem,288px)] flex-col rounded-2xl glass-sidebar">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-500 hover:bg-brand-goldPale hover:text-brand-navy"
              aria-label="Lukk meny"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between overflow-visible border-b border-slate-200 bg-white px-4 shadow-sm">
          <Link href="/app/oversikt" className="flex items-center">
            <SiteLogo
              variant="light"
              className="h-8 w-auto max-w-[11rem] object-contain object-left sm:h-9"
            />
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-xl border border-brand-border bg-white p-2 text-slate-600 shadow-sm"
            aria-label="Meny"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main
          className={cn(
            "app-scroll relative min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            isScanPage && "scan-glass-page-bg"
          )}
        >
          <div
            className={cn(
              "relative z-10 w-full min-w-0 max-w-none",
              isScanPage
                ? "px-0 py-0"
                : "px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6"
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
