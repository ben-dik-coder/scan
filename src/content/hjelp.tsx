import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { legal } from "@/lib/legal";
import { support } from "@/lib/support";
import { site } from "@/lib/site";

export function HjelpContent() {
  return (
    <>
      <p className="text-lg text-slate-700">
        Vi hjelper deg med konto, e-postkobling, skann, leads og abonnement. Velg den kanalen som
        passer best — vi svarer så fort vi kan.
      </p>

      <div className="not-prose mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-goldPale">
            <Mail className="h-5 w-5 text-brand-gold" aria-hidden />
          </div>
          <h2 className="mt-4 font-display text-lg font-bold text-brand-navy">E-post</h2>
          <p className="mt-1 text-sm text-slate-600">{support.emailResponseLabel}</p>
          <a
            href={`mailto:${support.email}`}
            className="mt-3 block break-all text-sm font-semibold text-brand-navy hover:underline"
          >
            {support.email}
          </a>
          <a
            href={`mailto:${support.email}?subject=Support%20-%20${encodeURIComponent(site.name)}`}
            className="btn-primary mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 text-sm"
          >
            Send e-post
          </a>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-goldPale">
            <Phone className="h-5 w-5 text-brand-gold" aria-hidden />
          </div>
          <h2 className="mt-4 font-display text-lg font-bold text-brand-navy">Telefon</h2>
          <p className="mt-1 text-sm text-slate-600">{support.phoneHoursLabel}</p>
          <a
            href={`tel:${support.phoneE164}`}
            className="mt-3 block text-sm font-semibold text-brand-navy hover:underline"
          >
            {support.phoneDisplay}
          </a>
          <a
            href={`tel:${support.phoneE164}`}
            className="btn-primary mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 text-sm"
          >
            Ring oss
          </a>
        </div>
      </div>

      <h2 className="mt-10">Hva vi hjelper med</h2>
      <ul>
        {support.topics.map((topic) => (
          <li key={topic}>{topic}</li>
        ))}
      </ul>

      <h2>Før du kontakter oss</h2>
      <p>Disse stedene løser ofte spørsmålet raskere:</p>
      <ul>
        <li>
          <Link href="/app/innstillinger">Innstillinger</Link> — koble e-post og varsel
        </li>
        <li>
          <Link href="/app">Skann</Link> — finn og filtrer leads
        </li>
        <li>
          <Link href="/#faq">FAQ på forsiden</Link> — vanlige spørsmål om bruk og lovlighet
        </li>
        <li>
          I appen: åpne <strong>Veiledning</strong> i menyen for steg-for-steg guide
        </li>
      </ul>

      <h2>Juridisk og personvern</h2>
      <p>
        For henvendelser om personvern og databehandling, se{" "}
        <Link href="/personvern">personvernerklæringen</Link>. Formell kontakt for{" "}
        {legal.operatorName}:{" "}
        <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>.
      </p>
    </>
  );
}
