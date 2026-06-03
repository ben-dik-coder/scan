"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { EmailConnect } from "@/components/EmailConnect";
import type { FilterState } from "@/components/CompanyFilters";
import { Settings, Bell, Webhook, BookOpen } from "lucide-react";

const EMAIL_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured:
    "Gmail er ikke satt opp på serveren ennå. Prøv Outlook (OAuth) eller app-passord i stedet.",
  microsoft_not_configured:
    "Outlook OAuth er ikke satt opp på serveren ennå. Prøv app-passord over, eller kontakt oss.",
  upgrade_email: "Du trenger aktivt NyLead-abonnement for å koble e-post. Gå til Abonnement.",
};

export default function InnstillingerClient() {
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<{ text: string; kind: "success" | "error" } | null>(
    null
  );
  const [webhookUrl, setWebhookUrl] = useState("");
  const [weeklyAlertEnabled, setWeeklyAlertEnabled] = useState(false);
  const [weeklyAlertFilters, setWeeklyAlertFilters] = useState<Partial<FilterState>>({});
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

  function useCurrentScanFilters() {
    const params = new URLSearchParams(window.location.search);
    setWeeklyAlertFilters({
      regionId: params.get("omrade") ?? "",
      municipalityCode: params.get("kommune") ?? "",
      days: Number(params.get("dager") ?? 30),
      hasEmail: params.get("epost") === "1",
      genericEmailOnly: params.get("generisk") === "1",
      industryGroup: params.get("bransje") ?? "",
      professionSearch: params.get("yrke") ?? "",
      websitePresence: (params.get("web") as FilterState["websitePresence"]) || "all",
      facebookPresence: (params.get("fb") as FilterState["facebookPresence"]) || "all",
      instagramPresence: (params.get("ig") as FilterState["instagramPresence"]) || "all",
    });
    setSaveMsg("Filter fra siste skann er lagt inn — husk å lagre.");
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2 text-brand-gold">
          <Settings className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Innstillinger</span>
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">E-post og konto</h1>
        <p className="mt-2 max-w-lg text-sm text-slate-600">
          Koble din e-post én gang. Kampanjer sendes fra din egen innboks — kunden svarer direkte
          til deg.
        </p>
        <p className="mt-2 max-w-lg text-xs text-slate-500">
          <strong>Gmail:</strong> ett klikk. <strong>Hotmail/Outlook:</strong> prøv app-passord
          først — hvis Microsoft sier basic auth er slått av, bruk <strong>Outlook (OAuth)</strong>.
        </p>
      </header>

      {banner && (
        <p
          className={
            banner.kind === "success"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          }
        >
          {banner.text}
        </p>
      )}

      <EmailConnect light />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Bell className="h-4 w-4 text-brand-gold" />
          Ukentlig e-postvarsel
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Hver mandag får du en e-post: «X nye firma i ditt filter» — basert på filteret under.
        </p>
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={weeklyAlertEnabled}
            onChange={(e) => setWeeklyAlertEnabled(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          Slå på ukentlig varsel
        </label>
        <button
          type="button"
          onClick={useCurrentScanFilters}
          className="mt-3 text-xs font-semibold text-sky-700 underline"
        >
          Bruk filter fra markedsanalyse (åpne /app først)
        </button>
        {Object.keys(weeklyAlertFilters).length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Lagret filter:{" "}
            {[
              weeklyAlertFilters.regionId && `område ${weeklyAlertFilters.regionId}`,
              weeklyAlertFilters.municipalityCode &&
                `kommune ${weeklyAlertFilters.municipalityCode}`,
              weeklyAlertFilters.days != null &&
                (weeklyAlertFilters.days === 0
                  ? "alle firma"
                  : `siste ${weeklyAlertFilters.days} d`),
            ]
              .filter(Boolean)
              .join(" · ") || "standard"}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Webhook className="h-4 w-4 text-brand-gold" />
          Webhook ved CSV-eksport
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Når du eksporterer valgte firma til CSV, kan vi sende JSON til denne URL-en (Zapier,
          Make, eget system).
        </p>
        <input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.example.com/nylead"
          className="scan-input mt-3 w-full"
        />
      </section>

      <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <BookOpen className="h-4 w-4" />
          Leveringsguide
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Tips om SPF, sendinggrenser og søppelpost.{" "}
          <Link href="/app/leveringsguide" className="font-semibold text-sky-700 underline">
            Les guiden
          </Link>
        </p>
      </section>

      <button
        type="button"
        onClick={saveSettings}
        disabled={saving}
        className="btn-primary px-6 disabled:opacity-50"
      >
        {saving ? "Lagrer…" : "Lagre innstillinger"}
      </button>
      {saveMsg && (
        <p className="text-sm text-slate-600">{saveMsg}</p>
      )}
    </div>
  );
}
