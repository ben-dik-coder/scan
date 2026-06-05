"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { isDemoMode } from "@/lib/demo/config";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Mail, Unlink } from "lucide-react";

type MailProvider = "google" | "microsoft" | "smtp";

type MailAccount = {
  id: string;
  provider: MailProvider;
  email: string;
};

type Props = {
  light?: boolean;
  compact?: boolean;
  /** Inni Innstillinger-kort — ingen ekstra ramme/tittel */
  embedded?: boolean;
};

function providerLabel(provider: MailProvider) {
  if (provider === "google") return "Gmail";
  if (provider === "smtp") return "Outlook (app-passord)";
  return "Outlook (OAuth)";
}

export function EmailConnect({
  light = true,
  compact = false,
  embedded = false,
}: Props) {
  const demo = isDemoMode();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [providers, setProviders] = useState({ google: false, microsoft: false });
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<MailProvider | null>(null);
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [smtpEmail, setSmtpEmail] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [showAllOptions, setShowAllOptions] = useState(false);

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

  async function disconnect(provider: MailProvider) {
    setDisconnecting(provider);
    try {
      await fetch(`/api/email/accounts?provider=${provider}`, { method: "DELETE" });
      await load();
      if (accounts.length <= 1) setShowAllOptions(true);
    } finally {
      setDisconnecting(null);
    }
  }

  async function saveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setSmtpSaving(true);
    setSmtpError(null);
    try {
      const res = await fetch("/api/email/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: smtpEmail, appPassword: smtpPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Kunne ikke lagre");
      }
      setSmtpPassword("");
      setSmtpOpen(false);
      setShowAllOptions(false);
      await load();
    } catch (err) {
      setSmtpError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setSmtpSaving(false);
    }
  }

  const boxClass = embedded
    ? ""
    : light
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
      <div
        className={cn(
          boxClass,
          "flex items-center gap-2 text-sm",
          light ? "text-slate-500" : "scan-glass-muted"
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Sjekker e-postkobling…
      </div>
    );
  }

  const google = accounts.find((a) => a.provider === "google");
  const microsoft = accounts.find((a) => a.provider === "microsoft");
  const smtp = accounts.find((a) => a.provider === "smtp");
  const hasConnected = accounts.length > 0;
  const collapseOptions =
    hasConnected && !showAllOptions && (embedded || compact);

  if (compact && hasConnected && !showAllOptions) {
    const primary = accounts[0];
    return (
      <p className={cn("text-xs", light ? "text-slate-500" : "text-white/45")}>
        <CheckCircle2
          className={cn(
            "mr-1 inline h-3.5 w-3.5",
            light ? "text-emerald-600" : "text-emerald-400"
          )}
          aria-hidden
        />
        Sendes fra{" "}
        <strong className={light ? "text-slate-700" : "text-white/80"}>
          {primary.email}
        </strong>{" "}
        ({providerLabel(primary.provider)})
        {" · "}
        <Link href="/app/innstillinger" className="font-semibold underline hover:text-brand-gold">
          Bytt konto
        </Link>
      </p>
    );
  }

  function renderProviderOptions() {
    return (
      <div className="space-y-2">
        <ProviderRow
          label="Outlook (OAuth)"
          hint={
            providers.microsoft
              ? "Anbefalt for Hotmail når app-passord feiler"
              : "Krever Azure-oppsett — se docs/OUTLOOK_SETUP.md"
          }
          connected={microsoft}
          configured={providers.microsoft}
          connectHref="/api/email/connect/microsoft"
          onDisconnect={() => disconnect("microsoft")}
          disconnecting={disconnecting === "microsoft"}
          light={light}
          muted={!providers.microsoft}
        />

        <ProviderRow
          label="Gmail"
          hint="Anbefalt — ett klikk"
          connected={google}
          configured={providers.google}
          connectHref="/api/email/connect/google"
          onDisconnect={() => disconnect("google")}
          disconnecting={disconnecting === "google"}
          light={light}
        />

        {smtp ? (
          <ProviderRow
            label="Outlook / Hotmail"
            hint="App-passord"
            connected={smtp}
            configured
            connectHref="#"
            onDisconnect={() => disconnect("smtp")}
            disconnecting={disconnecting === "smtp"}
            light={light}
          />
        ) : (
          <SmtpAccordion
            smtpOpen={smtpOpen}
            setSmtpOpen={setSmtpOpen}
            smtpEmail={smtpEmail}
            setSmtpEmail={setSmtpEmail}
            smtpPassword={smtpPassword}
            setSmtpPassword={setSmtpPassword}
            smtpSaving={smtpSaving}
            smtpError={smtpError}
            onSubmit={saveSmtp}
            light={light}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn(boxClass, compact && !embedded && "p-3")}>
      {embedded && (
        <p
          className={cn(
            "mb-3 text-sm font-semibold",
            light ? "text-slate-900" : "text-white"
          )}
        >
          Steg 1: Koble e-postkontoen din
        </p>
      )}
      {!embedded && (
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
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
      )}

      {collapseOptions ? (
        <div className={cn(!embedded && "mt-4", "space-y-2")}>
          {accounts.map((account) => (
            <ProviderRow
              key={account.provider}
              label={providerLabel(account.provider)}
              connected={account}
              configured
              connectHref="#"
              onDisconnect={() => disconnect(account.provider)}
              disconnecting={disconnecting === account.provider}
              light={light}
            />
          ))}
          <button
            type="button"
            onClick={() => setShowAllOptions(true)}
            className={cn(
              "w-full text-left text-xs font-semibold underline transition",
              light ? "text-slate-500 hover:text-slate-700" : "scan-glass-muted hover:text-white/70"
            )}
          >
            Legg til eller bytt konto
          </button>
        </div>
      ) : (
        <div className={cn(!embedded && "mt-4", "space-y-2")}>
          {hasConnected && (embedded || compact) && (
            <button
              type="button"
              onClick={() => setShowAllOptions(false)}
              className={cn(
                "mb-1 text-left text-xs underline transition",
                light ? "text-slate-400 hover:text-slate-600" : "text-white/35 hover:text-white/55"
              )}
            >
              Skjul andre valg
            </button>
          )}
          {renderProviderOptions()}
        </div>
      )}

      {!compact && !embedded && (
        <p className={cn("mt-3 text-xs", light ? "text-slate-400" : "text-white/35")}>
          Privat Hotmail som ikke tar app-passord? Bruk <strong>Outlook (OAuth)</strong> over
          (plattform-eier må sette opp Azure én gang).
        </p>
      )}
    </div>
  );
}

function SmtpAccordion({
  smtpOpen,
  setSmtpOpen,
  smtpEmail,
  setSmtpEmail,
  smtpPassword,
  setSmtpPassword,
  smtpSaving,
  smtpError,
  onSubmit,
  light,
}: {
  smtpOpen: boolean;
  setSmtpOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  smtpEmail: string;
  setSmtpEmail: (v: string) => void;
  smtpPassword: string;
  setSmtpPassword: (v: string) => void;
  smtpSaving: boolean;
  smtpError: string | null;
  onSubmit: (e: React.FormEvent) => void;
  light: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        light ? "border-slate-200 bg-slate-50/80" : "border-white/10 bg-white/[0.02]"
      )}
    >
      <button
        type="button"
        onClick={() => setSmtpOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold",
          light ? "text-slate-800" : "text-white/90"
        )}
      >
        <span>
          Outlook / Hotmail
          <span className={cn("ml-1.5 font-normal", light ? "text-slate-500" : "text-white/45")}>
            — app-passord (fungerer ikke for alle Hotmail)
          </span>
        </span>
        {smtpOpen ? (
          <ChevronUp className="h-4 w-4 shrink-0 opacity-60" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        )}
      </button>

      {smtpOpen && (
        <form
          onSubmit={onSubmit}
          className={cn(
            "space-y-2 border-t px-3 py-3",
            light ? "border-slate-200/80" : "border-white/10"
          )}
        >
          <p className={cn("text-[11px] leading-relaxed", light ? "text-slate-500" : "scan-glass-muted")}>
            Lag app-passord på{" "}
            <a
              href="https://account.microsoft.com/security"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-brand-gold"
            >
              account.microsoft.com/security
            </a>
            . Fungerer det ikke? Bruk <strong>Outlook (OAuth)</strong> over.
          </p>
          <input
            type="email"
            required
            placeholder="din@outlook.com eller @hotmail.com"
            value={smtpEmail}
            onChange={(e) => setSmtpEmail(e.target.value)}
            className={cn(
              "w-full rounded-md border px-2.5 py-2 text-xs",
              light ? "border-slate-200 bg-white text-slate-900" : "scan-input text-sm"
            )}
          />
          <input
            type="password"
            required
            autoComplete="off"
            placeholder="App-passord (16 tegn)"
            value={smtpPassword}
            onChange={(e) => setSmtpPassword(e.target.value)}
            className={cn(
              "w-full rounded-md border px-2.5 py-2 text-xs",
              light ? "border-slate-200 bg-white text-slate-900" : "scan-input text-sm"
            )}
          />
          {smtpError && (
            <p className={cn("text-[11px]", light ? "text-red-600" : "text-red-300")}>
              {smtpError}
            </p>
          )}
          <button
            type="submit"
            disabled={smtpSaving}
            className={cn(
              "w-full rounded-md px-3 py-2 text-xs font-semibold transition",
              light
                ? "bg-brand-gold text-slate-900 hover:bg-amber-400"
                : "bg-brand-gold/90 text-slate-900 hover:bg-brand-gold"
            )}
          >
            {smtpSaving ? "Tester og lagrer…" : "Lagre Outlook-kobling"}
          </button>
        </form>
      )}
    </div>
  );
}

function ProviderRow({
  label,
  hint,
  connected,
  configured,
  connectHref,
  onDisconnect,
  disconnecting,
  light,
  muted = false,
}: {
  label: string;
  hint?: string;
  connected?: MailAccount;
  configured: boolean;
  connectHref: string;
  onDisconnect: () => void;
  disconnecting: boolean;
  light: boolean;
  muted?: boolean;
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
      <p
        className={cn(
          "rounded-lg px-3 py-2 text-xs",
          light ? "bg-slate-50 text-slate-400" : "bg-white/5 scan-glass-muted",
          muted && "opacity-70"
        )}
      >
        {label}
        {hint ? ` — ${hint}` : " er ikke satt opp på serveren ennå."}
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
      {hint ? (
        <span className="mt-0.5 block text-[10px] font-normal opacity-70">{hint}</span>
      ) : null}
    </a>
  );
}

export function useConnectedEmail(): {
  accounts: MailAccount[];
  email: string | null;
  provider: MailProvider | null;
  loading: boolean;
  refresh: () => void;
} {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (isDemoMode()) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch("/api/email/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setAccounts((data?.accounts ?? []) as MailAccount[]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const first = accounts[0];
  return {
    accounts,
    email: first?.email ?? null,
    provider: first?.provider ?? null,
    loading,
    refresh,
  };
}

export { providerLabel };
