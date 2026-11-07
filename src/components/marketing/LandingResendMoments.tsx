import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MetalGlowTile } from "@/components/marketing/MetalGlowTile";
import { LandingNoirCta } from "@/components/marketing/LandingNoirCta";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils";

type Moment = {
  id: string;
  icon: "scan" | "enrich" | "voice" | "pipeline" | "inbox" | "ai";
  glow: "mint" | "amber" | "sky" | "violet";
  eyebrow?: string;
  titleBefore: string;
  titleAccent: string;
  titleAfter?: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  preview: "scan" | "enrich" | "voice" | "pipeline";
};

const MOMENTS: Moment[] = [
  {
    id: "skann",
    icon: "scan",
    glow: "mint",
    eyebrow: "Prospektering",
    titleBefore: "Skann markedet",
    titleAccent: "i dag",
    body: "Nye firma fra Brønnøysund, filtrert på sted og bransje. Se hvem som nettopp dukket opp — før konkurrentene gjør det.",
    primary: { href: "/app", label: "Åpne Skann" },
    secondary: { href: "#enrich", label: "Neste: kontaktinfo" },
    preview: "scan",
  },
  {
    id: "enrich",
    icon: "enrich",
    glow: "sky",
    eyebrow: "Enrichment",
    titleBefore: "Fra orgnr til",
    titleAccent: "kontaktkort",
    body: "Telefon, e-post, nettside og signaler fra åpne kilder — samlet i én rad du faktisk kan ringe eller sende til.",
    primary: { href: "/app", label: "Se leads med kontakt" },
    secondary: { href: "#ai-ring", label: "Neste: AI-ring" },
    preview: "enrich",
  },
  {
    id: "ai-ring",
    icon: "ai",
    glow: "amber",
    eyebrow: "AI-ringemodus",
    titleBefore: "La AI",
    titleAccent: "ringe for deg",
    titleAfter: "",
    body: "Research og skreddersydd manus går rett til ElevenLabs-stemmen. Den ringer outbound, speiler bransjen, og booker møte når det passer — du følger opp de som sier ja.",
    primary: { href: "/app/ring", label: "Åpne ringemodus" },
    secondary: { href: "/app/ko", label: "Se arbeidskø" },
    preview: "voice",
  },
  {
    id: "pipeline",
    icon: "pipeline",
    glow: "violet",
    eyebrow: "Oppfølging",
    titleBefore: "Hold tråden",
    titleAccent: "etter samtalen",
    body: "Ny, kontaktet, svar, møte. Pipeline og arbeidskø samler det AI ringte og det du sendte — uten Excel.",
    primary: { href: "/app/pipeline", label: "Åpne pipeline" },
    secondary: { href: "/app/ko", label: "Arbeidskø" },
    preview: "pipeline",
  },
];

export function LandingResendMoments() {
  return (
    <div className="landing-moments">
      {MOMENTS.map((m) => (
        <MomentSection key={m.id} moment={m} />
      ))}

      <section className="landing-moment border-t border-white/[0.06]">
        <Container wide className="py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <MetalGlowTile mark="inbox" className="mx-auto" />
            <h2 className="landing-noir-h2 mt-8">
              Skann. Enrich.{" "}
              <span className="landing-moment-accent landing-moment-accent--mint">Ring.</span>{" "}
              Følg opp.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
              NyLead er ikke bare en firmaliste. Det er motoren fra nye ENK til AI-samtale —
              bygget for norsk B2B.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <LandingNoirCta href="/app">Start i Skann</LandingNoirCta>
              <LandingNoirCta href="/app/ring" variant="accent">
                Prøv AI-ring
              </LandingNoirCta>
            </div>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-2">
            <FeatureCard
              title="Lead-signaler"
              body="Uten nettside, med telefon, ny i Brreg — filtrene som gjør lista verdifull."
              href="/app"
            >
              <MiniMetrics />
            </FeatureCard>
            <FeatureCard
              title="AI-samtaler"
              body="Transcript, utfall og neste steg etter hver outbound-samtale."
              href="/app/ai-samtaler"
            >
              <MiniCalls />
            </FeatureCard>
          </div>
        </Container>
      </section>
    </div>
  );
}

function MomentSection({ moment: m }: { moment: Moment }) {
  return (
    <section
      id={m.id}
      className="landing-moment border-t border-white/[0.06]"
    >
      <Container wide className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          {m.eyebrow ? (
            <p className="landing-noir-eyebrow">{m.eyebrow}</p>
          ) : null}
          <MetalGlowTile
            mark={m.icon === "ai" ? "ai" : m.icon}
            tone={m.glow}
            className="mx-auto mt-6"
          />
          <h2 className="landing-noir-h2 mt-8 text-balance">
            {m.titleBefore}{" "}
            <span
              className={cn(
                "landing-moment-accent",
                m.glow === "mint" && "landing-moment-accent--mint",
                m.glow === "amber" && "landing-moment-accent--amber",
                m.glow === "sky" && "landing-moment-accent--sky",
                m.glow === "violet" && "landing-moment-accent--violet"
              )}
            >
              {m.titleAccent}
            </span>
            {m.titleAfter ? ` ${m.titleAfter}` : null}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-[1.05rem]">
            {m.body}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LandingNoirCta href={m.primary.href}>{m.primary.label}</LandingNoirCta>
            {m.secondary ? (
              <Link
                href={m.secondary.href}
                className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-400 hover:text-white"
              >
                {m.secondary.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-4xl sm:mt-14">
          <MomentPreview kind={m.preview} glow={m.glow} />
        </div>
      </Container>
    </section>
  );
}

function MomentPreview({
  kind,
  glow,
}: {
  kind: Moment["preview"];
  glow: Moment["glow"];
}) {
  return (
    <div className={cn("moment-preview", `moment-preview--${glow}`)}>
      <div className="moment-preview-chrome">
        <span />
        <span />
        <span />
        <em>
          {kind === "scan"
            ? "Skann"
            : kind === "enrich"
              ? "Lead"
              : kind === "voice"
                ? "AI-ring"
                : "Pipeline"}
        </em>
      </div>
      <div className="moment-preview-body">
        {kind === "scan" ? <PreviewScan /> : null}
        {kind === "enrich" ? <PreviewEnrich /> : null}
        {kind === "voice" ? <PreviewVoice /> : null}
        {kind === "pipeline" ? <PreviewPipeline /> : null}
      </div>
    </div>
  );
}

function PreviewScan() {
  const rows = [
    ["Nordlys Maling ENK", "Narvik", "Ny", "92"],
    ["Troms Elektro AS", "Tromsø", "Ny", "88"],
    ["Fjord Spa AS", "Bodø", "Ny", "85"],
  ];
  return (
    <div className="moment-table">
      <div className="moment-table-head">
        <span>Firma</span>
        <span>Sted</span>
        <span>Status</span>
        <span>Score</span>
      </div>
      {rows.map(([n, s, st, sc], i) => (
        <div
          key={n}
          className={cn("moment-table-row", i === 0 && "moment-table-row--live")}
        >
          <span>{n}</span>
          <span>{s}</span>
          <span>{st}</span>
          <strong>{sc}</strong>
        </div>
      ))}
    </div>
  );
}

function PreviewEnrich() {
  return (
    <div className="moment-enrich">
      {[
        ["Telefon", "+47 9X XX XX XX", true],
        ["E-post", "post@nordlys-maling.no", true],
        ["Nettside", "Ikke funnet", false],
        ["Signal", "Nystartet · uten nett", true],
      ].map(([k, v, ok]) => (
        <div key={String(k)} className="moment-enrich-row">
          <span>{k}</span>
          <strong className={ok ? "text-zinc-100" : "text-amber-200/90"}>{v}</strong>
        </div>
      ))}
    </div>
  );
}

function PreviewVoice() {
  return (
    <div className="moment-voice">
      <div className="moment-voice-top">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Ringer nå
          </p>
          <p className="mt-1 font-display text-xl text-white">Nordlys Maling ENK</p>
          <p className="text-sm text-zinc-500">Frida · ElevenLabs · outbound</p>
        </div>
        <div className="moment-voice-wave" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <i key={i} style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      </div>
      <div className="moment-voice-script">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Script brief
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          «Mange nye malere lever på nettverk først — når folk googler maler Narvik,
          er det de med bilder og side som blir ringt. Har dere det på stell ennå?»
        </p>
      </div>
      <div className="moment-voice-tags">
        <span>Bransje: maler</span>
        <span>Uten nettside</span>
        <span>Book møte</span>
      </div>
    </div>
  );
}

function PreviewPipeline() {
  return (
    <div className="moment-pipe">
      {[
        ["Ny", 42, 70],
        ["Kontaktet", 28, 48],
        ["Svarte", 11, 22],
        ["Møte", 6, 14],
      ].map(([label, count, w]) => (
        <div key={String(label)} className="moment-pipe-row">
          <span>{label}</span>
          <div className="moment-pipe-track">
            <i style={{ width: `${w}%` }} />
          </div>
          <strong>{count}</strong>
        </div>
      ))}
    </div>
  );
}

function FeatureCard({
  title,
  body,
  href,
  children,
}: {
  title: string;
  body: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <article className="moment-feature-card">
      <div className="moment-feature-visual">{children}</div>
      <h3 className="mt-5 font-display text-xl text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">{body}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-zinc-200 hover:text-white"
      >
        Åpne
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

function MiniMetrics() {
  return (
    <div className="mini-metrics">
      <div>
        <p>Uten nett</p>
        <strong>128</strong>
      </div>
      <div>
        <p>Med tlf</p>
        <strong>64</strong>
      </div>
      <svg viewBox="0 0 120 36" className="mini-spark" aria-hidden>
        <path
          d="M0 28 C20 26, 30 10, 45 14 S70 30, 90 8 110 6, 120 4"
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
        />
        <path
          d="M0 36 L0 28 C20 26, 30 10, 45 14 S70 30, 90 8 110 6, 120 4 V36 Z"
          fill="url(#sparkFill)"
          opacity="0.35"
        />
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#34d399" />
            <stop offset="1" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function MiniCalls() {
  return (
    <div className="mini-calls">
      {[
        ["Booket møte", "ok"],
        ["Ikke interessert", "mute"],
        ["Ringer…", "live"],
      ].map(([t, s]) => (
        <div key={t} className="mini-calls-row">
          <i className={`mini-dot mini-dot--${s}`} />
          <span>{t}</span>
        </div>
      ))}
    </div>
  );
}
