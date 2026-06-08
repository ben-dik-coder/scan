"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AgentChatFab, AgentChatPanel } from "@/components/agent/AgentChatPanel";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { TutorialMenuButton } from "@/components/onboarding/TutorialMenuButton";
import { SiteLogo } from "@/components/layout/SiteLogo";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo/config";
import {
  Building2,
  CreditCard,
  FileText,
  GitBranch,
  Headphones,
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
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

function isAppRoute(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/");
}

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV_OVERVIEW: NavItem = {
  href: "/app/oversikt",
  label: "Oversikt",
  icon: LayoutDashboard,
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Prospektering",
    items: [
      { href: "/app", label: "Skann", icon: Building2 },
      { href: "/app/ko", label: "Arbeidskø", icon: ListTodo },
    ],
  },
  {
    title: "Oppfølging",
    items: [
      { href: "/app/pipeline", label: "Pipeline", icon: GitBranch },
      { href: "/app/kampanjer", label: "Kampanjer", icon: Send },
      { href: "/app/sekvenser", label: "Sekvenser", icon: Workflow },
    ],
  },
  {
    title: "Innhold",
    items: [{ href: "/app/maler", label: "Maler", icon: FileText }],
  },
  {
    title: "Innstillinger",
    items: [
      { href: "/app/innstillinger", label: "Koble e-post", icon: Mail },
      { href: "/app/abonnement", label: "Abonnement", icon: CreditCard },
    ],
  },
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
  const [agentOpen, setAgentOpen] = useState(false);
  const isGlassShell = isAppRoute(pathname);
  const isScanPage = pathname === "/app";

  useEffect(() => {
    if (!isGlassShell) return;
    document.documentElement.classList.add("app-glass-theme");
    document.body.classList.add("app-glass-theme");
    return () => {
      document.documentElement.classList.remove("app-glass-theme");
      document.body.classList.remove("app-glass-theme");
    };
  }, [isGlassShell]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

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

  const groupLabelClass = cn(
    "app-nav-group-label px-3 pb-0.5 pt-2 text-[0.65rem] font-semibold uppercase tracking-wider first:pt-0",
    isGlassShell ? "text-slate-400" : "text-slate-500"
  );

  function NavLink({ href, label, icon: Icon }: NavItem) {
    return (
      <Link
        href={href}
        onClick={() => setDrawerOpen(false)}
        className={navLinkClass(href)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </Link>
    );
  }

  const sidebarContent = (
    <>
      {demo && (
        <div className="px-4 pb-1 pt-4">
          <p
            className={cn(
              "flex items-center gap-1 text-xs font-semibold",
              isGlassShell ? "text-sky-400" : "text-brand-gold"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Demo
          </p>
        </div>
      )}

      <nav
        className={cn(
          "flex-1 space-y-3 overflow-y-auto px-3",
          demo ? "pt-2" : "pt-4"
        )}
      >
        <div className="space-y-1">
          <NavLink {...NAV_OVERVIEW} />
        </div>
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className={groupLabelClass}>{group.title}</p>
            {group.items.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        ))}
        <div className="space-y-1 border-t border-white/10 pt-3">
          <p className={groupLabelClass}>Hjelp</p>
          <TutorialMenuButton onOpen={() => setDrawerOpen(false)} />
          <Link
            href="/hjelp"
            onClick={() => setDrawerOpen(false)}
            className={navLinkClass("/hjelp")}
          >
            <Headphones className="h-4 w-4 shrink-0" />
            Support
          </Link>
        </div>
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

      <div
        className={cn(
          "border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          isGlassShell ? "scan-glass-shell-footer" : "border-brand-border"
        )}
      >
        <button type="button" onClick={logout} className="glass-nav-link w-full">
          <LogOut className="h-4 w-4" />
          Logg ut
        </button>
      </div>
    </>
  );

  return (
    <OnboardingProvider>
    <div
      className={cn(
        "app-shell-bg flex min-h-screen",
        isGlassShell ? "scan-glass-page-bg scan-glass-shell" : "text-brand-navy"
      )}
      style={
        isGlassShell
          ? { backgroundColor: "#234a73", color: "#f8fafc", minHeight: "100vh" }
          : undefined
      }
    >
      {drawerOpen && (
        <div
          className="scan-mobile-drawer-overlay fixed inset-0 z-[100] isolate"
          role="dialog"
          aria-modal="true"
          aria-label="Navigasjonsmeny"
        >
          <div
            className={cn(
              "absolute inset-0",
              isGlassShell
                ? "scan-glass-backdrop scan-glass-drawer-backdrop"
                : "bg-slate-900/40 backdrop-blur-sm"
            )}
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside
            className={cn(
              "absolute bottom-3 left-3 top-3 z-[1] flex w-[min(100vw-1.5rem,288px)] flex-col overflow-hidden rounded-2xl",
              isGlassShell ? "scan-glass-mobile-drawer" : "glass-sidebar"
            )}
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "absolute right-3 top-3 z-10 rounded-lg p-2 transition",
                isGlassShell
                  ? "scan-glass-shell-drawer-close"
                  : "text-slate-500 hover:bg-brand-goldPale hover:text-brand-navy"
              )}
              aria-label="Lukk meny"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-30 flex h-14 items-center justify-between overflow-visible border-b px-4",
            isGlassShell
              ? "scan-glass-shell-header"
              : "border-slate-200 bg-white shadow-sm"
          )}
        >
          <Link href="/app/oversikt" className="app-shell-logo-link flex items-center">
            <SiteLogo
              variant={isGlassShell ? "dark" : "light"}
              className="h-8 w-auto max-w-[11rem] object-contain object-left sm:h-9"
            />
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={
              isGlassShell
                ? "scan-glass-shell-menu-btn"
                : "rounded-xl border border-brand-border bg-white p-2 text-slate-600 shadow-sm"
            }
            aria-label="Meny"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="app-scroll relative min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto bg-transparent pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div
            className={cn(
              "relative z-10 w-full min-w-0 max-w-none",
              isGlassShell && "scan-glass-kommand",
              isGlassShell && isScanPage
                ? "px-0 py-0"
                : "px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6"
            )}
          >
            {children}
          </div>
        </main>

        {isGlassShell && (
          <>
            <AgentChatFab onOpen={() => setAgentOpen(true)} />
            <AgentChatPanel open={agentOpen} onClose={() => setAgentOpen(false)} />
          </>
        )}
      </div>
    </div>
    </OnboardingProvider>
  );
}
