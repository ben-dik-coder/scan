import Link from "next/link";
import {
  Bot,
  Captions,
  Phone,
  PhoneCall,
  PhoneOff,
  CalendarCheck,
  ThumbsDown,
  ThumbsUp,
  ScrollText,
} from "lucide-react";

const QUEUE = [
  "Nordlys Bygg AS",
  "Fjord Data AS",
  "Alta Handel",
  "Oslo Craft Co",
  "Trøndelag Media",
  "Bodø Studio",
  "Ålesund Fix",
];

/** Design-preview — tettere Vapi-layout. */
export default function RingVapiPreviewPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0a0a0a] text-zinc-100">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0f0f0f] px-3">
        <PhoneCall className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-medium text-white">Ring</span>
        <span className="text-xs text-zinc-500">· 12 i kø</span>
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
          Live
        </span>
        <Link
          href="/app/ring"
          className="ml-auto text-xs text-zinc-500 hover:text-emerald-400"
        >
          Åpne ekte Ring →
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_26rem]">
        <aside className="hidden min-h-0 flex-col border-r border-white/[0.06] bg-[#0c0c0c] md:flex">
          <div className="flex h-9 items-center justify-between px-3">
            <span className="text-[11px] font-medium text-zinc-500">Kø</span>
            <span className="text-[11px] tabular-nums text-zinc-600">3/12</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {QUEUE.map((name, i) => (
              <div
                key={name}
                className={`flex items-center gap-2 px-3 py-2 text-sm ${
                  i === 0
                    ? "bg-emerald-500/10 text-white"
                    : "text-zinc-500"
                }`}
              >
                <span
                  className={`w-4 text-center text-[10px] tabular-nums ${
                    i === 0 ? "text-emerald-400" : "text-zinc-700"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="truncate">{name}</span>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center space-y-4">
            <section className="rounded-xl border border-white/[0.08] bg-[#111]">
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    Lead
                  </p>
                  <h2 className="mt-0.5 text-lg font-semibold text-white">
                    Nordlys Bygg AS
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  I samtale…
                </span>
              </div>
              <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 px-4 py-3 text-sm">
                <dt className="text-zinc-600">Telefon</dt>
                <dd className="font-mono text-zinc-200">900 12 345</dd>
                <dt className="text-zinc-600">Kontakt</dt>
                <dd className="text-zinc-300">Kari Nordmann</dd>
                <dt className="text-zinc-600">Sted</dt>
                <dd className="text-zinc-300">Lillehammer · 12. okt 2026</dd>
                <dt className="text-zinc-600">Info</dt>
                <dd className="text-zinc-400">uten nettside · 72 poeng</dd>
              </dl>
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-[#111] p-3">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-black"
              >
                <Bot className="h-4 w-4" />
                Talk · live
              </button>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-zinc-400"
                >
                  <Phone className="h-3.5 w-3.5" /> Selv
                </button>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-zinc-400"
                >
                  <Captions className="h-3.5 w-3.5" /> Lytt
                </button>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-zinc-400"
                >
                  <ScrollText className="h-3.5 w-3.5" /> Manus
                </button>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#111]">
              <p className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Utfall
              </p>
              <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
                {[
                  { Icon: PhoneOff, label: "Ikke svar" },
                  { Icon: ThumbsUp, label: "Svarte" },
                  { Icon: CalendarCheck, label: "Møte" },
                  { Icon: ThumbsDown, label: "Nei" },
                ].map(({ Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center justify-center gap-1.5 px-2 py-3 text-xs text-zinc-400"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>

        <aside className="flex min-h-0 flex-col border-t border-white/[0.06] bg-[#0f0f0f] md:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0">
          <div className="flex h-9 items-stretch border-b border-white/[0.06]">
            {["AI", "Lytt", "Manus"].map((label, i) => (
              <div
                key={label}
                className={`relative flex flex-1 items-center justify-center text-[11px] font-medium ${
                  i === 0 ? "text-white" : "text-zinc-500"
                }`}
              >
                {label}
                {i === 0 ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-400" />
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <div>
              <span className="text-[11px] font-medium text-emerald-400">Assistant</span>
              <div className="mt-1 max-w-[92%] rounded-2xl rounded-tl-md bg-[#1a2e28] px-3.5 py-2.5 text-sm text-zinc-100">
                Hei! Jeg er en digital assistent som ringer på vegne av North Digital. Har
                du ti sekunder?
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-medium text-orange-300">User</span>
              <div className="mt-1 max-w-[92%] rounded-2xl rounded-tr-md bg-[#2a241c] px-3.5 py-2.5 text-sm text-zinc-100">
                Ja,
              </div>
            </div>
            <div>
              <span className="text-[11px] font-medium text-emerald-400">Assistant</span>
              <div className="mt-1 max-w-[92%] rounded-2xl rounded-tl-md bg-[#1a2e28] px-3.5 py-2.5 text-sm text-zinc-100">
                Flott. Jeg ringer fordi dere nylig har startet opp. Vi hos North Digital
                hjelper nye bedrifter med å komme godt i gang digitalt.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
