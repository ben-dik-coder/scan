import Link from "next/link";
import { Mail, Shield, AlertTriangle } from "lucide-react";

export default function LeveringsguidePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <div className="flex items-center gap-2 text-brand-gold">
          <Mail className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Hjelp</span>
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">
          Leveringsguide for e-post
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Slik unngår du at meldingene dine havner i søppelpost — og holder deg innenfor
          gode rutiner.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Shield className="h-4 w-4 text-emerald-600" />
          SPF, DKIM og DMARC
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>
            Send fra din egen koblede konto (Gmail/Outlook) — da bruker du domenets
            eksisterende oppsett.
          </li>
          <li>
            Har du eget domene (f.eks. firma.no), sjekk hos domeneleverandør at{" "}
            <strong>SPF</strong> tillater utsending fra Microsoft/Google.
          </li>
          <li>
            <strong>DKIM</strong> signeres ofte automatisk av Gmail og Microsoft 365.
          </li>
          <li>
            Sett <strong>DMARC</strong> til minst p=none med rapportering før du strammer
            policy.
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Anbefalte grenser</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Start med 20–50 mottakere per dag når kontoen er ny til utsending.</li>
          <li>Øk gradvis over 1–2 uker — ikke hundrevis første dag.</li>
          <li>Hold pauser mellom utsendelser (NyLead gjør dette automatisk).</li>
          <li>Unngå store vedlegg og mange lenker i første melding.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-amber-950">
          <AlertTriangle className="h-4 w-4" />
          Personvern og samtykke
        </h2>
        <p className="mt-2 text-sm text-amber-950">
          Kontakt bare firma du har et reelt forretningsgrunnlag til å nå. Bruk
          avmeldingslenken i hver melding. Les også{" "}
          <Link href="/vilkar" className="font-semibold underline">
            vilkårene
          </Link>
          .
        </p>
      </section>

      <p className="text-sm text-slate-500">
        <Link href="/app/innstillinger" className="font-semibold text-sky-700 underline">
          Tilbake til innstillinger
        </Link>
      </p>
    </div>
  );
}
