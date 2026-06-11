import { Check } from "lucide-react";

const FILTER_SECTIONS = [
  { label: "Område", value: "Innlandet" },
  { label: "Kommune", value: "Alle" },
  { label: "Bransje", value: "Alle" },
  { label: "Periode", value: "Siste 30 dager" },
  { label: "Yrke", value: "Alle" },
] as const;

const FILTER_TOGGLES = ["Med e-post", "Med telefon", "Uten nettside"] as const;

const TABLE_ROWS = [
  {
    name: "Tommeliten Barneklær AS",
    score: "92",
    email: "post@tommeliten.no",
    phone: "62 12 34 56",
    website: "—",
    status: "Ny",
  },
  {
    name: "Hakket Bedre AS",
    score: "88",
    email: "hei@hakketbedre.no",
    phone: "62 98 76 54",
    website: "—",
    status: "Ny",
  },
  {
    name: "Fjellro AS",
    score: "85",
    email: "kontakt@fjellro.no",
    phone: "61 45 67 89",
    website: "fjellro.no",
    status: "Ny",
    saveTarget: true,
  },
  {
    name: "Nordlys Kaffe AS",
    score: "81",
    email: "info@nordlyskaffe.no",
    phone: "62 11 22 33",
    website: "—",
    status: "Ny",
  },
  {
    name: "Østfold Verksted AS",
    score: "79",
    email: "post@ostfoldverksted.no",
    phone: "69 44 55 66",
    website: "—",
    status: "Ny",
  },
  {
    name: "Bergmann Media AS",
    score: "76",
    email: "hei@bergmannmedia.no",
    phone: "62 77 88 99",
    website: "bergmann.no",
    status: "Ny",
  },
  {
    name: "Solheim Reklame AS",
    score: "74",
    email: "kontakt@solheim.no",
    phone: "61 33 44 55",
    website: "—",
    status: "Ny",
  },
  {
    name: "Vestfold Teknikk AS",
    score: "71",
    email: "info@vestfoldteknikk.no",
    phone: "33 12 34 56",
    website: "—",
    status: "Ny",
  },
] as const;

const TABLE_COLGROUP = (
  <colgroup>
    <col />
    <col className="w-9" />
    <col className="w-[4.5rem]" />
    <col className="w-[3.75rem]" />
    <col className="w-[3.75rem]" />
    <col className="w-12" />
  </colgroup>
);

const thClass =
  "whitespace-nowrap px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#98989d]";
const tdClass = "overflow-hidden px-2 py-0.5";

export function HeroScanMockup() {
  return (
    <div
      className="hero-scan-mockup flex min-h-[390px] w-full min-w-0 overflow-hidden bg-[#1c1c1e] text-[#f5f5f7] sm:min-w-[540px]"
      role="img"
      aria-label="Forhåndsvisning av NyLead Skann — filtrerer, scroller gjennom firma, velger Fjellro AS og lagrer i liste"
    >
      <aside className="hidden w-[10.5rem] shrink-0 flex-col border-r border-white/[0.06] bg-[#2c2c2e]/60 sm:flex">
        <div className="border-b border-white/[0.06] px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#98989d]">
            Filtre
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-3">
          {FILTER_SECTIONS.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#636366]">
                {label}
              </p>
              <p className="mt-0.5 truncate rounded-md border border-white/[0.06] bg-[#3a3a3c] px-2 py-1 text-xs text-[#d1d1d6]">
                {value}
              </p>
            </div>
          ))}
          <div className="pt-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#636366]">
              Presets
            </p>
            <p className="mt-0.5 rounded-md border border-[#0a84ff]/30 bg-[#0a84ff]/15 px-2 py-1 text-xs font-medium text-[#0a84ff]">
              Selger nettsider
            </p>
          </div>
          <div className="space-y-2 pt-0.5">
            {FILTER_TOGGLES.map((toggle, i) => (
              <div key={toggle} className="flex items-center justify-between gap-1.5">
                <span className="text-xs text-[#98989d]">{toggle}</span>
                <span
                  className={`hero-scan-filter-toggle hero-scan-filter-toggle--${i + 1} relative h-[1.3125rem] w-9 shrink-0 rounded-full bg-[#3a3a3c]`}
                  aria-hidden
                >
                  <span className="hero-scan-filter-knob absolute top-0.5 left-0.5 h-[0.9375rem] w-[0.9375rem] rounded-full bg-white shadow-sm" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-white/[0.06] bg-[#2c2c2e]/80 px-4 pb-2 pt-3">
          <p className="text-base font-semibold leading-snug text-white">
            Skann markedet
          </p>
          <p className="text-xs text-[#98989d]">Innlandet · Siste 30 dager</p>
        </div>

        <div className="hero-scan-table-wrap min-h-0 flex-1 overflow-hidden pb-[3.75rem]">
          <table className="w-full table-fixed border-collapse text-left">
            {TABLE_COLGROUP}
            <thead>
              <tr className="border-b border-white/[0.06] bg-[#2c2c2e]/50">
                <th className={thClass}>Firma</th>
                <th className={`${thClass} w-9`}>Score</th>
                <th className={`${thClass} w-[4.5rem]`}>E-post</th>
                <th className={`${thClass} w-[3.75rem]`}>Tlf</th>
                <th className={`${thClass} w-[3.75rem]`}>Nettside</th>
                <th className={`${thClass} w-12`}>Status</th>
              </tr>
            </thead>
          </table>

          <div className="hero-scan-viewport relative overflow-hidden">
            <div className="hero-scan-track">
              <table className="w-full table-fixed border-collapse text-left">
                {TABLE_COLGROUP}
                <tbody>
                  {TABLE_ROWS.map((row) => (
                    <tr
                      key={row.name}
                      className={`hero-scan-table-row border-b border-white/[0.04] ${
                        "saveTarget" in row && row.saveTarget ? "hero-scan-table-row--target" : ""
                      }`}
                    >
                      <td className={`${tdClass} min-w-0 truncate text-xs font-medium text-white`}>
                        {row.name}
                      </td>
                      <td className={`${tdClass} w-9 whitespace-nowrap text-xs`}>
                        <span
                          className={`font-semibold text-[#0a84ff] ${
                            "saveTarget" in row && row.saveTarget ? "hero-scan-score" : ""
                          }`}
                        >
                          {row.score}
                        </span>
                      </td>
                      <td
                        className={`${tdClass} w-[4.5rem] truncate text-[10px] text-[#98989d]`}
                      >
                        {row.email}
                      </td>
                      <td
                        className={`${tdClass} w-[3.75rem] whitespace-nowrap text-[10px] text-[#98989d]`}
                      >
                        {row.phone}
                      </td>
                      <td
                        className={`${tdClass} w-[3.75rem] truncate text-[10px] text-[#98989d]`}
                      >
                        {row.website}
                      </td>
                      <td className={`${tdClass} w-12`}>
                        <span className="hero-scan-status hero-scan-status--new inline-flex rounded-full bg-white/[0.06] px-2 py-px text-[10px] font-medium text-[#d1d1d6]">
                          {row.status}
                        </span>
                        {"saveTarget" in row && row.saveTarget && (
                          <span className="hero-scan-status hero-scan-status--saved inline-flex items-center gap-0.5 rounded-full bg-[#0a84ff]/20 px-2 py-px text-[10px] font-semibold text-[#0a84ff]">
                            <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                            Lagret
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hero-scan-row-highlight pointer-events-none" aria-hidden />
            <div className="hero-scan-fade-top pointer-events-none" aria-hidden />
            <div className="hero-scan-fade-bottom pointer-events-none" aria-hidden />
            <div className="hero-scan-cursor pointer-events-none" aria-hidden>
              <svg
                width="24"
                height="27"
                viewBox="0 0 16 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 1L1 14.5L4.5 11.5L7.5 17L9.5 16L6.5 10.5L11 10.5L1 1Z"
                  fill="white"
                  stroke="#0a84ff"
                  strokeWidth="1.25"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="hero-scan-actions pointer-events-none" aria-hidden>
          <div className="hero-scan-save-toast">
            <Check className="h-3 w-3 shrink-0" strokeWidth={3} />
            <span>Lagret i liste</span>
          </div>
        </div>
      </div>
    </div>
  );
}
