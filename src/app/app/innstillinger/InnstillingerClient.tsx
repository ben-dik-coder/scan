"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { EmailConnect } from "@/components/EmailConnect";
import type { FilterState } from "@/components/CompanyFilters";
import { PageHeader } from "@/components/ui/primitives";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import {
  formatWeeklyAlertSummary,
  WeeklyAlertFilters,
} from "@/components/settings/WeeklyAlertFilters";
import { loadScanAudienceFilters } from "@/lib/scan/lead-modes";
import {
  Bell,
  BookOpen,
  CreditCard,
  Headphones,
  Mail,
  Phone,
  Sparkles,
  User,
  Webhook,
} from "lucide-react";
import { support } from "@/lib/support";

const EMAIL_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured:
    "Gmail er ikke satt opp på serveren ennå. Prøv Outlook (OAuth) eller app-passord i stedet.",
  microsoft_not_configured:
    `Outlook OAuth er ikke satt opp på serveren ennå. Prøv app-passord over, eller kontakt ${support.email}.`,
  upgrade_email: "Du trenger aktivt NyLead-abonnement for å koble e-post. Gå til Abonnement.",
};

function SettingsCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="app-settings-card scan-surface space-y-3 p-4 sm:p-5">
      <h2 className="scan-glass-strong flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-sky-400" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function InnstillingerClient({
  userEmail,
}: {
  userEmail: string | null;
}) {
  const searchParams = useSearchParams();
  const { canRestart, openOnboarding } = useOnboarding();
  const [banner, setBanner] = useState<{ text: string; kind: "success" | "error" } | null>(
    null
  );
  const [webhookUrl, setWebhookUrl] = useState("");
  const [weeklyAlertEnabled, setWeeklyAlertEnabled] = useState(false);
  const [weeklyAlertFilters, setWeeklyAlertFilters] = useState<Partial<FilterState>>({});
  const [municipalities, setMunicipalities] = useState<
    Array<{ code: string; name: string; count: number }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "google") {
      setBanner({
        kind: "success",
        text: "Gmail er koblet! Du kan sende kampanjer fra din adresse.",
      });
    } else if (connected === "microsoft") {
      setBanner({
        kind: "success",
        text: "Outlook er koblet! Du kan sende kampanjer fra din adresse.",
      });
    } else if (error) {
      const decoded = decodeURIComponent(error);
      setBanner({
        kind: "error",
        text:
          EMAIL_ERROR_MESSAGES[decoded] ??
          `Kunne ikke koble e-post: ${decoded}`,
      });
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
        setWeeklyAlertEnabled(Boolean(data.weeklyAlertEnabled));
        setWeeklyAlertFilters(data.weeklyAlertFilters ?? {});
      })
      .catch(() => {});

    fetch("/api/kommuner")
      .then((r) => r.json())
      .then((data) => {
        if (data.municipalities?.length) setMunicipalities(data.municipalities);
      })
      .catch(() => {});

  }, []);

  async function saveSettings() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl,
          weeklyAlertEnabled,
          weeklyAlertFilters,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lagring feilet");
      setSaveMsg("Innstillinger lagret.");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Feil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="scan-glass-kommand space-y-4 pb-8">
      <PageHeader
        title="E-post og konto"
        description="Koble e-post, varsler og integrasjoner. Kampanjer sendes fra din egen innboks."
      />

      {userEmail && (
        <p className="scan-glass-muted flex items-center gap-2 text-xs">
          <User className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden />
          Innlogget som <span className="scan-glass-strong font-medium">{userEmail}</span>
        </p>
      )}

      {banner && (
        <p
          className={
            banner.kind === "success"
              ? "rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100"
              : "rounded-xl border border-amber-400/35 bg-amber-500/15 px-4 py-3 text-sm text-amber-100"
          }
          role="status"
        >
          {banner.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {canRestart && (
          <button
            type="button"
            onClick={openOnboarding}
            className="scan-btn-ghost inline-flex items-center gap-1.5 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Kom i gang
          </button>
        )}
        <Link
          href="/app/abonnement"
          className="scan-btn-ghost inline-flex items-center gap-1.5 text-xs"
        >
          <CreditCard className="h-3.5 w-3.5" aria-hidden />
          Abonnement
        </Link>
      </div>

      <SettingsCard title="E-post" icon={Mail}>
        <p className="scan-glass-muted text-xs leading-relaxed">
          Kampanjer sendes fra din egen konto — ikke fra NyLead.
        </p>
        <EmailConnect light={false} embedded />
      </SettingsCard>

      <SettingsCard title="Varsler" icon={Bell}>
        <p className="scan-glass-muted text-sm">
          Ca. 2 ganger i uken (mandag og torsdag) får du e-post når nye firma matcher filteret.
          Lenken åpner Skann med «uten nettside».
        </p>
        <label className="app-settings-checkbox flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={weeklyAlertEnabled}
            onChange={(e) => setWeeklyAlertEnabled(e.target.checked)}
            className="h-4 w-4 rounded accent-sky-500"
          />
          <span className="scan-glass-strong">Slå på e-postvarsel</span>
        </label>
        {weeklyAlertEnabled && (
          <>
            <button
              type="button"
              onClick={() => {
                const fromScan = loadScanAudienceFilters();
                if (fromScan && Object.keys(fromScan).length > 0) {
                  setWeeklyAlertFilters(fromScan);
                  setSaveMsg("Filter fra Skann er lagt inn — husk å lagre.");
                } else {
                  setSaveMsg("Ingen lagret filter fra Skann ennå — velg filter på Skann først.");
                }
              }}
              className="scan-btn-ghost text-xs"
            >
              Bruk filter fra Skann
            </button>
            <WeeklyAlertFilters
              filters={weeklyAlertFilters}
              municipalities={municipalities}
              onChange={setWeeklyAlertFilters}
            />
          </>
        )}
        {!weeklyAlertEnabled && Object.keys(weeklyAlertFilters).length > 0 && (
          <p className="scan-glass-muted text-[11px]">
            Lagret filter (aktiveres når varsel er på):{" "}
            {formatWeeklyAlertSummary(weeklyAlertFilters)}
          </p>
        )}
      </SettingsCard>

      <SettingsCard title="Integrasjoner" icon={Webhook}>
        <p className="scan-glass-muted text-sm">
          JSON sendes til Zapier, Make eller CRM når du <strong className="scan-glass-strong">legger et lead i arbeidskø</strong>{" "}
          (status «ny»), og ved CSV-eksport hvis du huker av der.
        </p>
        <input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.zapier.com/hooks/catch/…"
          className="scan-input w-full"
          autoComplete="off"
        />
        <details className="scan-glass-muted text-[11px] leading-snug">
          <summary className="cursor-pointer font-semibold text-sky-300 hover:text-sky-200">
            Slik kobler du Zapier
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Zapier → Webhooks by Zapier → Catch Hook</li>
            <li>Lim URL inn over og lagre</li>
            <li>Legg et firma i arbeidskø i NyLead (test)</li>
            <li>Zapier → action (HubSpot, Pipedrive, Google Sheets…)</li>
          </ol>
          <p className="mt-2">
            JSON-felt: <code className="text-sky-200">event</code> ={" "}
            <code className="text-sky-200">lead.queued</code>, pluss{" "}
            <code className="text-sky-200">lead.name</code>,{" "}
            <code className="text-sky-200">lead.email</code> osv.
          </p>
        </details>
      </SettingsCard>

      <SettingsCard title="Support" icon={Headphones}>
        <p className="scan-glass-muted text-sm">
          {support.emailResponseLabel} · {support.phoneHoursLabel}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a
            href={`mailto:${support.email}`}
            className="scan-btn-ghost inline-flex min-h-[40px] items-center gap-2 px-3 text-sm font-semibold"
          >
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            {support.email}
          </a>
          <a
            href={`tel:${support.phoneE164}`}
            className="scan-btn-ghost inline-flex min-h-[40px] items-center gap-2 px-3 text-sm font-semibold"
          >
            <Phone className="h-4 w-4 shrink-0" aria-hidden />
            {support.phoneDisplay}
          </a>
        </div>
        <Link
          href="/hjelp"
          className="inline-flex text-sm font-semibold text-sky-300 underline hover:text-sky-200"
        >
          Se hjelpesiden
        </Link>
      </SettingsCard>

      <SettingsCard title="Hjelp" icon={BookOpen}>
        <p className="scan-glass-muted text-sm">
          Tips om SPF, sendinggrenser og søppelpost.{" "}
          <Link
            href="/app/leveringsguide"
            className="font-semibold text-sky-300 underline hover:text-sky-200"
          >
            Les leveringsguiden
          </Link>
        </p>
      </SettingsCard>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="scan-btn-primary min-h-[44px] px-6 disabled:opacity-50"
        >
          {saving ? "Lagrer…" : "Lagre innstillinger"}
        </button>
        {saveMsg && (
          <p className="scan-glass-muted text-sm" role="status">
            {saveMsg}
          </p>
        )}
      </div>
    </div>
  );
}
