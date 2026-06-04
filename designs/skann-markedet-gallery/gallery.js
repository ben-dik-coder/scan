/** Skann markedet — 20 unike visuelle mockups (design-artifact, ikke prod) */

const COMPANIES = [
  { name: "NARVIK RØR & VVS AS", orgnr: "923 456 789", email: "post@narvikror.no", phone: "769 12 345", web: "Ingen nettside", webClass: "warn", fb: true, ig: false, checked: true },
  { name: "OFOTEN ELEKTRO ENK", orgnr: "987 654 321", email: "info@ofotenelektro.no", phone: "912 34 567", web: "ofotenelektro.no", webClass: "ok", fb: false, ig: true, checked: false },
  { name: "POLAR BYGG & MONTASJE", orgnr: "912 345 678", email: null, phone: "478 90 123", web: "Usikker", webClass: "muted", fb: false, ig: false, checked: false },
  { name: "NORDLYS IT-TJENESTER DA", orgnr: "934 567 890", email: "hei@nordlysit.no", phone: null, web: "Ingen nettside", webClass: "warn", fb: true, ig: true, checked: false },
];

const TABS = [
  { label: "Alle", short: "Alle", count: 31 },
  { label: "Med nettside", short: "Med", count: 12 },
  { label: "Uten nettside", short: "Uten", count: 14 },
  { label: "Ikke sjekket", short: "Ujekket", count: 5 },
];

const VARIANTS = [
  {
    id: "01-nordisk-minimal",
    name: "Nordisk Minimal",
    tag: "Lys · luftig · tynne linjer",
    layout: "default",
    theme: {
      bg: "#f8faf9", surface: "#ffffff", text: "#1a2e28", muted: "#6b7f78",
      accent: "#2d6a5a", accentText: "#fff", border: "#dce8e3", radius: "6px",
      font: "'DM Sans', system-ui, sans-serif", chipBg: "#eef5f2",
      headerStyle: "flat", density: "normal", shadow: "none",
    },
  },
  {
    id: "02-brutalist-mono",
    name: "Brutalist Mono",
    tag: "Svart/hvit · tykke kanter · mono",
    layout: "default",
    theme: {
      bg: "#ffffff", surface: "#ffffff", text: "#000000", muted: "#444444",
      accent: "#000000", accentText: "#ffffff", border: "#000000", radius: "0",
      font: "'IBM Plex Mono', monospace", chipBg: "#ffffff",
      headerStyle: "brutal", density: "normal", shadow: "none", borderWidth: "3px",
    },
  },
  {
    id: "03-glass-kommand",
    name: "Glass Kommand",
    tag: "Mørk · frostet glass · blur",
    layout: "default",
    theme: {
      bg: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0c4a6e 100%)",
      surface: "rgba(255,255,255,0.08)", text: "#f1f5f9", muted: "#94a3b8",
      accent: "#38bdf8", accentText: "#0f172a", border: "rgba(255,255,255,0.15)", radius: "16px",
      font: "'Inter', system-ui, sans-serif", chipBg: "rgba(255,255,255,0.06)",
      headerStyle: "glass", density: "normal", shadow: "none", glass: true,
    },
  },
  {
    id: "04-retro-win95",
    name: "Retro Win95",
    tag: "Grå · relieff-knapper · system-UI",
    layout: "default",
    theme: {
      bg: "#008080", surface: "#c0c0c0", text: "#000000", muted: "#404040",
      accent: "#000080", accentText: "#ffffff", border: "#808080", radius: "0",
      font: "'Tahoma', 'MS Sans Serif', sans-serif", chipBg: "#dfdfdf",
      headerStyle: "retro", density: "compact", shadow: "retro", retro: true,
    },
  },
  {
    id: "05-stripe-klarhet",
    name: "Stripe Klarhet",
    tag: "Hvit · indigo · mye luft",
    layout: "default",
    theme: {
      bg: "#fafafa", surface: "#ffffff", text: "#0a2540", muted: "#697386",
      accent: "#635bff", accentText: "#ffffff", border: "#e3e8ee", radius: "8px",
      font: "'Inter', system-ui, sans-serif", chipBg: "#f6f9fc",
      headerStyle: "stripe", density: "spacious", shadow: "subtle",
    },
  },
  {
    id: "06-regneark-pro",
    name: "Regneark Pro",
    tag: "Ultra-kompakt · Excel-vibe",
    layout: "spreadsheet",
    theme: {
      bg: "#f3f3f3", surface: "#ffffff", text: "#217346", muted: "#595959",
      accent: "#217346", accentText: "#ffffff", border: "#d4d4d4", radius: "2px",
      font: "'Segoe UI', system-ui, sans-serif", chipBg: "#e7f4ec",
      headerStyle: "flat", density: "dense", shadow: "none", tableHead: "#217346",
      tableHeadText: "#ffffff",
    },
  },
  {
    id: "07-kortstabel",
    name: "Kortstabel",
    tag: "Kort i stedet for tabell",
    layout: "cards",
    theme: {
      bg: "#f0f4f8", surface: "#ffffff", text: "#1e293b", muted: "#64748b",
      accent: "#0ea5e9", accentText: "#ffffff", border: "#e2e8f0", radius: "12px",
      font: "'Plus Jakarta Sans', system-ui, sans-serif", chipBg: "#f1f5f9",
      headerStyle: "flat", density: "normal", shadow: "card",
    },
  },
  {
    id: "08-sidebar-filtre",
    name: "Sidebar Filtre",
    tag: "Filtre i venstre panel",
    layout: "sidebar",
    theme: {
      bg: "#f5f5f4", surface: "#ffffff", text: "#292524", muted: "#78716c",
      accent: "#b45309", accentText: "#ffffff", border: "#e7e5e4", radius: "8px",
      font: "'Source Sans 3', system-ui, sans-serif", chipBg: "#fafaf9",
      headerStyle: "flat", density: "normal", shadow: "none", sidebarBg: "#fafaf9",
    },
  },
  {
    id: "09-chip-bar",
    name: "Chip-Bar",
    tag: "Alle filtre som horisontale chips",
    layout: "chips",
    theme: {
      bg: "#fff7ed", surface: "#ffffff", text: "#431407", muted: "#9a3412",
      accent: "#ea580c", accentText: "#ffffff", border: "#fed7aa", radius: "999px",
      font: "'Nunito', system-ui, sans-serif", chipBg: "#ffedd5",
      headerStyle: "flat", density: "normal", shadow: "none",
    },
  },
  {
    id: "10-varm-notion",
    name: "Varm Notion",
    tag: "Beige · myk · dokument-vibe",
    layout: "default",
    theme: {
      bg: "#fbf8f3", surface: "#ffffff", text: "#37352f", muted: "#9b9a97",
      accent: "#d97706", accentText: "#ffffff", border: "#ebe8e3", radius: "4px",
      font: "'Lora', Georgia, serif", chipBg: "#f7f6f3",
      headerStyle: "notion", density: "normal", shadow: "none", bodyFont: "'Inter', sans-serif",
    },
  },
  {
    id: "11-havbris",
    name: "Havbris",
    tag: "Teal · kyst · frisk",
    layout: "default",
    theme: {
      bg: "#ecfeff", surface: "#ffffff", text: "#164e63", muted: "#0e7490",
      accent: "#0891b2", accentText: "#ffffff", border: "#a5f3fc", radius: "10px",
      font: "'Outfit', system-ui, sans-serif", chipBg: "#cffafe",
      headerStyle: "wave", density: "normal", shadow: "none",
    },
  },
  {
    id: "12-skog-gronn",
    name: "Skog Grønn",
    tag: "Dyp grønn · enterprise",
    layout: "default",
    theme: {
      bg: "#f0fdf4", surface: "#ffffff", text: "#14532d", muted: "#166534",
      accent: "#15803d", accentText: "#ffffff", border: "#bbf7d0", radius: "6px",
      font: "'Work Sans', system-ui, sans-serif", chipBg: "#dcfce7",
      headerStyle: "enterprise", density: "normal", shadow: "none",
    },
  },
  {
    id: "13-solnedgang-salg",
    name: "Solnedgang Salg",
    tag: "Korall · energi · salgsfokus",
    layout: "default",
    theme: {
      bg: "#fff1f2", surface: "#ffffff", text: "#881337", muted: "#be123c",
      accent: "#e11d48", accentText: "#ffffff", border: "#fecdd3", radius: "14px",
      font: "'Rubik', system-ui, sans-serif", chipBg: "#ffe4e6",
      headerStyle: "bold", density: "normal", shadow: "warm",
    },
  },
  {
    id: "14-midnight-gull",
    name: "Midnight Gull",
    tag: "Mørk navy · gull-accenter",
    layout: "default",
    theme: {
      bg: "#0f172a", surface: "#1e293b", text: "#f8fafc", muted: "#94a3b8",
      accent: "#d4a853", accentText: "#0f172a", border: "#334155", radius: "8px",
      font: "'Playfair Display', Georgia, serif", chipBg: "#334155",
      headerStyle: "luxury", density: "normal", shadow: "none", bodyFont: "'Inter', sans-serif",
    },
  },
  {
    id: "15-sveitsisk-grid",
    name: "Sveitsisk Grid",
    tag: "Streng grid · rød accent",
    layout: "default",
    theme: {
      bg: "#ffffff", surface: "#ffffff", text: "#111111", muted: "#666666",
      accent: "#ff0000", accentText: "#ffffff", border: "#111111", radius: "0",
      font: "'Helvetica Neue', Helvetica, Arial, sans-serif", chipBg: "#ffffff",
      headerStyle: "swiss", density: "normal", shadow: "none", borderWidth: "1px",
    },
  },
  {
    id: "16-pastell-soft",
    name: "Pastell Soft",
    tag: "Lavendel · avrundet · vennlig",
    layout: "cards",
    theme: {
      bg: "#faf5ff", surface: "#ffffff", text: "#581c87", muted: "#9333ea",
      accent: "#a855f7", accentText: "#ffffff", border: "#e9d5ff", radius: "20px",
      font: "'Quicksand', system-ui, sans-serif", chipBg: "#f3e8ff",
      headerStyle: "soft", density: "normal", shadow: "soft",
    },
  },
  {
    id: "17-hoy-kontrast",
    name: "Høy Kontrast",
    tag: "A11y · fet svart/gul",
    layout: "default",
    theme: {
      bg: "#000000", surface: "#000000", text: "#ffffff", muted: "#ffff00",
      accent: "#ffff00", accentText: "#000000", border: "#ffffff", radius: "4px",
      font: "'Atkinson Hyperlegible', system-ui, sans-serif", chipBg: "#1a1a1a",
      headerStyle: "a11y", density: "normal", shadow: "none", borderWidth: "2px",
    },
  },
  {
    id: "18-terminal-matrix",
    name: "Terminal Matrix",
    tag: "Grønn på svart · monospace",
    layout: "spreadsheet",
    theme: {
      bg: "#0a0a0a", surface: "#0d1110", text: "#00ff41", muted: "#00aa2a",
      accent: "#00ff41", accentText: "#0a0a0a", border: "#003b00", radius: "0",
      font: "'JetBrains Mono', 'Courier New', monospace", chipBg: "#0d1a0d",
      headerStyle: "terminal", density: "dense", shadow: "none", scanline: true,
    },
  },
  {
    id: "19-editorial-serif",
    name: "Editorial Serif",
    tag: "Avis/magasin · serif overskrifter",
    layout: "default",
    theme: {
      bg: "#faf9f6", surface: "#ffffff", text: "#1c1917", muted: "#57534e",
      accent: "#44403c", accentText: "#faf9f6", border: "#d6d3d1", radius: "2px",
      font: "'Libre Baskerville', Georgia, serif", chipBg: "#f5f5f4",
      headerStyle: "editorial", density: "spacious", shadow: "none", bodyFont: "'Source Serif 4', serif",
    },
  },
  {
    id: "20-neubrutalist-pop",
    name: "Neubrutalist Pop",
    tag: "Fet farge · offset-skygger",
    layout: "chips",
    theme: {
      bg: "#fef08a", surface: "#ffffff", text: "#000000", muted: "#525252",
      accent: "#ec4899", accentText: "#ffffff", border: "#000000", radius: "0",
      font: "'Space Grotesk', system-ui, sans-serif", chipBg: "#bfdbfe",
      headerStyle: "neo", density: "normal", shadow: "neo", borderWidth: "3px",
    },
  },
];

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function btnStyle(t) {
  if (t.retro) return "background:#dfdfdf;border:2px outset #fff;box-shadow:inset -1px -1px #0a0a0a,inset 1px 1px #fff;";
  if (t.shadow === "neo") return `background:${t.accent};color:${t.accentText};border:${t.borderWidth||"3px"} solid ${t.border};box-shadow:4px 4px 0 ${t.border};`;
  return `background:${t.accent};color:${t.accentText};border:none;border-radius:${t.radius};`;
}

function chipStyle(t, active) {
  const bw = t.borderWidth || "1px";
  if (t.retro) return `padding:3px 8px;font-size:10px;background:#dfdfdf;border:1px outset #fff;border-radius:0;`;
  if (active) return `padding:4px 10px;font-size:10px;background:${t.accent};color:${t.accentText};border-radius:${t.radius};border:${bw} solid ${t.accent};`;
  return `padding:4px 10px;font-size:10px;background:${t.chipBg};border:${bw} solid ${t.border};border-radius:${t.radius};color:${t.text};`;
}

function inputStyle(t) {
  const bw = t.borderWidth || "1px";
  if (t.retro) return `width:100%;padding:4px 6px;font-size:10px;background:#fff;border:2px inset #808080;border-radius:0;font-family:${t.font};`;
  if (t.glass) return `width:100%;padding:6px 8px;font-size:10px;background:rgba(255,255,255,0.05);border:1px solid ${t.border};border-radius:${t.radius};color:${t.text};backdrop-filter:blur(8px);font-family:${t.font};`;
  return `width:100%;padding:6px 8px;font-size:10px;background:${t.surface};border:${bw} solid ${t.border};border-radius:${t.radius};color:${t.text};font-family:${t.bodyFont||t.font};`;
}

function surfaceStyle(t) {
  const bw = t.borderWidth || "1px";
  let s = `background:${t.surface};border:${bw} solid ${t.border};border-radius:${t.radius};color:${t.text};font-family:${t.bodyFont||t.font};`;
  if (t.glass) s += "backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);";
  if (t.shadow === "subtle") s += "box-shadow:0 1px 3px rgba(0,0,0,0.06);";
  if (t.shadow === "card") s += "box-shadow:0 2px 8px rgba(0,0,0,0.08);";
  if (t.shadow === "soft") s += "box-shadow:0 4px 16px rgba(168,85,247,0.12);";
  if (t.shadow === "warm") s += "box-shadow:0 4px 14px rgba(225,29,72,0.15);";
  if (t.shadow === "neo") s += "box-shadow:6px 6px 0 #000;";
  return s;
}

function renderHeader(t) {
  const titleFont = t.font;
  const subtitleFont = t.bodyFont || t.font;
  let headerBg = t.surface;
  if (t.headerStyle === "brutal") headerBg = t.accent;
  if (t.headerStyle === "retro") headerBg = "#000080";
  if (t.headerStyle === "terminal") headerBg = "#003b00";
  if (t.headerStyle === "luxury") headerBg = t.bg;
  if (t.headerStyle === "glass") headerBg = "rgba(255,255,255,0.05)";

  const titleColor = t.headerStyle === "brutal" || t.headerStyle === "retro" || t.headerStyle === "terminal" ? (t.headerStyle === "brutal" ? t.accentText : "#fff") : t.text;
  const subColor = t.headerStyle === "brutal" || t.headerStyle === "retro" ? (t.headerStyle === "retro" ? "#ccc" : t.muted) : t.muted;

  return `
    <div style="padding:${t.density==="spacious"?"14px 16px":"10px 12px"};${t.headerStyle==="wave"?"border-bottom:3px solid "+t.accent:""}background:${headerBg};${t.headerStyle==="swiss"?"border-bottom:4px solid "+t.accent:""}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
        <div>
          <h2 style="margin:0;font-size:${t.density==="dense"?"13px":"15px"};font-weight:700;font-family:${titleFont};color:${titleColor};letter-spacing:${t.headerStyle==="swiss"?"-0.02em":"normal"};">Skann markedet</h2>
          <p style="margin:2px 0 0;font-size:9px;color:${subColor};font-family:${subtitleFont};">Velg firma → sjekk (maks 10) → send e-post</p>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          <span style="${chipStyle(t,false)}">31 firma</span>
          <span style="${chipStyle(t,false)}">24 med e-post</span>
        </div>
      </div>
      <details style="margin-top:4px;font-size:8px;color:${subColor};">
        <summary style="cursor:pointer;">Tilfeldig rekkefølge denne måneden</summary>
      </details>
    </div>`;
}

function renderFiltersDefault(t) {
  const labels = [
    { label: "Område", val: "Nordland" },
    { label: "Kommune", val: "Narvik" },
    { label: "Bransje", val: "Alle bransjer" },
    { label: "Periode", val: "Siste 30 dager" },
  ];
  const gap = t.density === "dense" ? "4px" : "6px";
  return `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:${gap};">
      ${labels.map((l) => `
        <label style="display:flex;flex-direction:column;gap:2px;">
          <span style="font-size:8px;font-weight:600;color:${t.muted};text-transform:${t.headerStyle==="swiss"?"uppercase":"none"};letter-spacing:${t.headerStyle==="swiss"?"0.05em":"normal"};">${l.label}</span>
          <select style="${inputStyle(t)}">${esc(l.val)}</select>
        </label>`).join("")}
    </div>
    <div style="margin-top:6px;padding-top:6px;border-top:1px solid ${t.border};">
      <span style="font-size:7px;font-weight:700;text-transform:uppercase;color:${t.muted};letter-spacing:0.05em;">Bransje-presets</span>
      <div style="margin-top:4px;"><span style="${chipStyle(t,true)}">Selger nettsider (Brreg)</span></div>
    </div>
    <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">
      <span style="${chipStyle(t,false)}">Kun med e-post</span>
      <span style="${chipStyle(t,false)}">Kun post@ / info@</span>
    </div>
    <p style="margin:4px 0 0;font-size:8px;color:${t.muted};">Nordland · Siste 30 dager</p>`;
}

function renderFiltersChips(t) {
  const chips = ["Nordland", "Narvik", "Alle bransjer", "Siste 30 dager", "Selger nettsider", "Kun e-post"];
  return `
    <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:${t.muted};margin-bottom:6px;">Filtre</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;">
      ${chips.map((c, i) => `<span style="${chipStyle(t, i < 2)}">${esc(c)}</span>`).join("")}
    </div>
    <input placeholder="Søk yrke…" style="${inputStyle(t)};margin-top:6px;" value="" />`;
}

function renderFiltersSidebar(t) {
  const items = [
    { label: "Område", val: "Nordland" },
    { label: "Kommune", val: "Narvik" },
    { label: "Bransje", val: "Alle bransjer" },
    { label: "Periode", val: "Siste 30 dager" },
  ];
  return `
    <aside style="background:${t.sidebarBg||t.chipBg};border-right:1px solid ${t.border};padding:10px;min-width:90px;">
      <div style="font-size:7px;font-weight:700;text-transform:uppercase;color:${t.muted};margin-bottom:8px;">Filtre</div>
      ${items.map((i) => `
        <div style="margin-bottom:8px;">
          <div style="font-size:8px;color:${t.muted};margin-bottom:2px;">${i.label}</div>
          <div style="${inputStyle(t)}">${esc(i.val)}</div>
        </div>`).join("")}
      <div style="margin-top:8px;"><span style="${chipStyle(t,true)};font-size:8px;">Nettsider</span></div>
    </aside>`;
}

function renderGoogleCheck(t) {
  const pad = t.density === "dense" ? "6px" : "8px";
  return `
    <div style="padding:${pad};border-top:1px solid ${t.border};display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span style="font-size:7px;font-weight:700;text-transform:uppercase;color:${t.muted};">Google-sjekk</span>
        <label style="${chipStyle(t,true)};display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" checked disabled style="width:10px;height:10px;"/> Facebook</label>
        <label style="${chipStyle(t,false)};display:inline-flex;align-items:center;gap:3px;"><input type="checkbox" disabled style="width:10px;height:10px;"/> Instagram</label>
      </div>
      <button style="${btnStyle(t)};padding:5px 10px;font-size:9px;font-weight:700;font-family:${t.font};cursor:default;">Start sjekk (1)</button>
    </div>
    <div style="padding:0 ${pad} ${pad};">
      <div style="font-size:8px;color:${t.muted};margin-bottom:3px;">Sjekker nettside… 7 av 10</div>
      <div style="height:5px;background:${t.border};border-radius:${t.radius};overflow:hidden;">
        <div style="width:72%;height:100%;background:${t.accent};border-radius:${t.radius};"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px;font-size:7px;color:${t.muted};">
        <span>Med nettside: 12</span><span>Uten: 14</span><span>Ikke sjekket: 5</span>
      </div>
    </div>`;
}

function renderTabs(t) {
  return `
    <div style="padding:6px 8px;border-top:1px solid ${t.border};display:flex;gap:3px;flex-wrap:wrap;">
      ${TABS.map((tab, i) => `<span style="${chipStyle(t, i===0)};font-size:8px;">${tab.short} <strong>${tab.count}</strong></span>`).join("")}
    </div>
    <div style="padding:4px 8px;font-size:8px;color:${t.muted};display:flex;justify-content:space-between;">
      <span>Viser <strong style="color:${t.text};">1–10</strong> av <strong style="color:${t.text};">31</strong></span>
      <span>Side <strong>1</strong> / 4</span>
    </div>`;
}

function renderTable(t) {
  const pad = t.density === "dense" ? "3px 5px" : "5px 7px";
  const fs = t.density === "dense" ? "8px" : "9px";
  const headBg = t.tableHead || t.chipBg;
  const headColor = t.tableHeadText || t.text;
  const cols = t.density === "dense"
    ? ["", "Firma", "E-post", "Nettside", "Status"]
    : ["", "Firma", "Org.nr", "E-post", "Nettside", "Status"];

  const rows = COMPANIES.map((c) => {
    const webColor = c.webClass === "warn" ? (t.accent === "#ffff00" ? "#ffff00" : "#d97706") : c.webClass === "ok" ? t.muted : t.muted;
    if (t.density === "dense") {
      return `<tr style="border-top:1px solid ${t.border};">
        <td style="padding:${pad};"><input type="checkbox" ${c.checked?"checked":""} disabled style="width:9px;height:9px;"/></td>
        <td style="padding:${pad};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;">${esc(c.name)}</td>
        <td style="padding:${pad};color:${c.email?t.text:t.muted};">${c.email?esc(c.email):"—"}</td>
        <td style="padding:${pad};color:${webColor};">${esc(c.web)}</td>
        <td style="padding:${pad};"><span style="font-size:7px;padding:1px 4px;background:${t.chipBg};border-radius:${t.radius};">Ny</span></td>
      </tr>`;
    }
    return `<tr style="border-top:1px solid ${t.border};">
      <td style="padding:${pad};"><input type="checkbox" ${c.checked?"checked":""} disabled style="width:9px;height:9px;"/></td>
      <td style="padding:${pad};font-weight:600;font-size:${fs};">${esc(c.name)}</td>
      <td style="padding:${pad};color:${t.muted};font-size:${fs};">${esc(c.orgnr)}</td>
      <td style="padding:${pad};font-size:${fs};">${c.email?esc(c.email):"—"}</td>
      <td style="padding:${pad};color:${webColor};font-size:${fs};">${esc(c.web)}</td>
      <td style="padding:${pad};"><span style="font-size:7px;padding:1px 5px;background:${t.chipBg};border-radius:999px;">Ny</span></td>
    </tr>`;
  }).join("");

  return `
    <div style="overflow:hidden;border-top:1px solid ${t.border};">
      <table style="width:100%;border-collapse:collapse;font-size:${fs};">
        <thead><tr style="background:${headBg};color:${headColor};text-align:left;">
          ${cols.map((c) => `<th style="padding:${pad};font-weight:600;">${c}</th>`).join("")}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderCards(t) {
  return `
    <div style="padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;border-top:1px solid ${t.border};">
      ${COMPANIES.slice(0, 4).map((c) => `
        <div style="${surfaceStyle(t)};padding:8px;">
          <label style="display:flex;gap:4px;align-items:flex-start;font-size:8px;">
            <input type="checkbox" ${c.checked?"checked":""} disabled style="width:9px;height:9px;margin-top:2px;"/>
            <div>
              <div style="font-weight:700;font-size:9px;line-height:1.2;">${esc(c.name)}</div>
              <div style="color:${t.muted};font-size:7px;margin-top:2px;">Narvik</div>
              <div style="margin-top:4px;color:${c.webClass==="warn"?"#d97706":t.muted};">${esc(c.web)}</div>
            </div>
          </label>
        </div>`).join("")}
    </div>`;
}

function renderScanMockup(variant) {
  const t = variant.theme;
  const bw = t.borderWidth || "1px";
  let filters;
  let bodyLayout = "";

  if (variant.layout === "sidebar") {
    bodyLayout = `<div style="display:flex;">${renderFiltersSidebar(t)}<div style="flex:1;min-width:0;">`;
    filters = `<div style="padding:8px;font-size:8px;color:${t.muted};">Nordland · Narvik · 30 dager</div>`;
  } else if (variant.layout === "chips") {
    filters = `<div style="padding:8px;">${renderFiltersChips(t)}</div>`;
  } else {
    filters = `<div style="padding:8px;border-top:1px solid ${t.border};">${renderFiltersDefault(t)}</div>`;
  }

  const list = variant.layout === "cards" ? renderCards(t) : renderTable(t);
  const closeSidebar = variant.layout === "sidebar" ? "</div></div>" : "";

  const scanline = t.scanline ? `<div style="position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,65,0.03) 2px,rgba(0,255,65,0.03) 4px);"></div>` : "";

  return `
    <div class="mockup-root" style="position:relative;overflow:hidden;background:${t.bg};${t.bodyFont?`font-family:${t.bodyFont};`:""}height:100%;${t.scanline?"font-variant-numeric:tabular-nums;":""}">
      ${scanline}
      <div style="margin:6px;${surfaceStyle(t)};overflow:hidden;border:${bw} solid ${t.border};">
        ${renderHeader(t)}
        ${bodyLayout}
        ${filters}
        ${renderGoogleCheck(t)}
        ${renderTabs(t)}
        ${list}
        ${closeSidebar}
        <div style="padding:6px 8px;border-top:1px solid ${t.border};display:flex;justify-content:space-between;align-items:center;font-size:8px;">
          <span>1 valgt · <span style="color:${t.muted};">Velg synlige</span></span>
          <button style="${btnStyle(t)};padding:4px 8px;font-size:8px;font-weight:700;font-family:${t.font};">Send kampanje</button>
        </div>
      </div>
    </div>`;
}

function initGallery() {
  const grid = document.getElementById("gallery-grid");
  const lightbox = document.getElementById("lightbox");
  const lightboxContent = document.getElementById("lightbox-content");
  const lightboxTitle = document.getElementById("lightbox-title");
  const lightboxTag = document.getElementById("lightbox-tag");

  VARIANTS.forEach((v, i) => {
    const card = document.createElement("article");
    card.className = "variant-card";
    card.innerHTML = `
      <div class="variant-meta">
        <span class="variant-num">#${String(i + 1).padStart(2, "0")}</span>
        <h3>${esc(v.name)}</h3>
        <p>${esc(v.tag)}</p>
        <code>${esc(v.id)}</code>
      </div>
      <div class="variant-preview">${renderScanMockup(v)}</div>
    `;
    card.addEventListener("click", () => {
      lightboxTitle.textContent = v.name;
      lightboxTag.textContent = `${v.tag} · ${v.id}`;
      lightboxContent.innerHTML = renderScanMockup(v);
      lightbox.showModal();
    });
    grid.appendChild(card);
  });

  document.getElementById("lightbox-close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.close(); });
}

document.addEventListener("DOMContentLoaded", initGallery);
