"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { isDemoMode } from "@/lib/demo/config";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Mail, Unlink } from "lucide-react";

type MailAccount = {
  id: string;
  provider: "google" | "microsoft";
  email: string;
};

type Props = {
  light?: boolean;
  compact?: boolean;
};

export function EmailConnect({ light = false, compact = false }: Props) {
  const demo = isDemoMode();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [providers, setProviders] = useState({ google: false, microsoft: false });
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (demo) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/email/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts ?? []);
        setProviders(data.providers ?? { google: false, microsoft: false });
      }
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    void load();
  }, [load]);

  async function disconnect(provider: "google" | "microsoft") {
    setDisconnecting(provider);
    try {
      await fetch(`/api/email/accounts?provider=${provider}`, { method: "DELETE" });
      await load();
    } finally {
      setDisconnecting(null);
    }
  }

  const boxClass = light
    ? "rounded-xl border border-slate-200 bg-white/80 p-4"
    : "rounded-lg border border-white/10 bg-white/[0.03] p-4";

  if (demo) {
    return (
      <div className={boxClass}>
        <p className={cn("text-sm", light ? "text-slate-600" : "text-white/55")}>
          I demo kan du «øve» på sending. For ekte Gmail/Outlook:{" "}
          <Link href="/registrer" className="font-semibold text-brand-gold underline">
            opprett konto
          </Link>{" "}
          og koble e-post under Innstillinger.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn(boxClass, "flex items-center gap-2 text-sm text-slate-500")}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Sjekker e-postkobling…
      </div>
    );
  }

  const google = accounts.find((a) => a.provider === "google");
  const microsoft = accounts.find((a) => a.provider === "microsoft");

  return (
    <div className={cn(boxClass, compact && "p-3")}>
      <div className="flex items-start gap-2">
        <Mail className={cn("mt-0.5 h-4 w-4 shrink-0", light ? "text-brand-gold" : "text-brand-gold")} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-semibold",
              light ? "text-slate-900" : "text-white"
            )}
          >
            Din e-post
          </p>
          <p className={cn("mt-1 text-xs", light ? "text-slate-500" : "text-white/45")}>
            Kampanjer sendes fra kontoen du kobler her — ikke fra NyLead.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <ProviderRow
          label="Gmail"
          connected={google}
          configured={providers.google}
          connectHref="/api/email/connect/google"
          onDisconnect={() => disconnect("google")}
          disconnecting={disconnecting === "google"}
          light={light}
        />
        <ProviderRow
          label="Outlook"
          connected={microsoft}
          configured={providers.microsoft}
          connectHref="/api/email/connect/microsoft"
          onDisconnect={() => disconnect("microsoft")}
          disconnecting={disconnecting === "microsoft"}
          light={light}
        />
      </div>

      {!compact && (
        <p className={cn("mt-3 text-xs", light ? "text-slate-400" : "text-white/35")}>
          <Link href="/app/innstillinger" className="underline hover:text-brand-gold">
            Flere innstillinger
          </Link>
        </p>
      )}
    </div>
  );
}

function ProviderRow({
  label,
  connected,
  configured,
  connectHref,
  onDisconnect,
  disconnecting,
  light,
}: {
  label: string;
  connected?: MailAccount;
  configured: boolean;
  connectHref: string;
  onDisconnect: () => void;
  disconnecting: boolean;
  light: boolean;
}) {
  if (connected) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-lg px-3 py-2",
          light ? "bg-emerald-50 text-emerald-900" : "bg-emerald-500/10 text-emerald-200"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold">{label}</p>
            <p className="truncate text-[11px] opacity-80">{connected.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={disconnecting}
          className="shrink-0 rounded p-1 opacity-70 hover:opacity-100"
          title="Koble fra"
        >
          {disconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Unlink className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }

  if (!configured) {
    return (
      <p className={cn("rounded-lg px-3 py-2 text-xs", light ? "bg-slate-50 text-slate-400" : "bg-white/5 text-white/35")}>
        {label} er ikke satt opp på serveren ennå.
      </p>
    );
  }

  return (
    <a
      href={connectHref}
      className={cn(
        "block rounded-lg border px-3 py-2.5 text-center text-xs font-semibold transition",
        light
          ? "border-slate-200 bg-white hover:border-brand-gold/40 hover:bg-amber-50/50"
          : "border-white/15 bg-white/5 hover:border-brand-gold/30"
      )}
    >
      Koble {label}
    </a>
  );
}

export function useConnectedEmail(): {
  email: string | null;
  loading: boolean;
  refresh: () => void;
} {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (isDemoMode()) {
      setEmail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/email/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const first = data?.accounts?.[0] as MailAccount | undefined;
        setEmail(first?.email ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { email, loading, refresh };
}
