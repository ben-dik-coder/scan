export type ThemeMeta = {
  id: string;
  name: string;
  nameNo: string;
  vibe: string;
  whenToUse: string;
  folder: string;
};

export const COMPANY_VIEW_THEMES: ThemeMeta[] = [
  {
    id: "minimal-white",
    name: "Minimal White",
    nameNo: "Minimal hvit",
    vibe: "Luftig, ren, nesten ingen dekor",
    whenToUse: "Når du vil at listen skal føles rolig og profesjonell uten støy.",
    folder: "01-minimal-white",
  },
  {
    id: "midnight-dark",
    name: "Midnight Dark",
    nameNo: "Midnatt mørk",
    vibe: "Mørk bakgrunn, lys tekst, fokus om kvelden",
    whenToUse: "For brukere som liker dark mode og jobber sent.",
    folder: "02-midnight-dark",
  },
  {
    id: "card-grid",
    name: "Card Grid",
    nameNo: "Kort-rutenett",
    vibe: "Fargerike kort i to kolonner, lett å skanne",
    whenToUse: "Mobilvennlig oversikt når hvert firma er et lite kort.",
    folder: "03-card-grid",
  },
  {
    id: "compact-table",
    name: "Compact Table",
    nameNo: "Kompakt tabell",
    vibe: "Tett tabell, mange firma på én skjerm",
    whenToUse: "Power users som vil se maks antall rader uten scrolling.",
    folder: "04-compact-table",
  },
  {
    id: "magazine-editorial",
    name: "Magazine Editorial",
    nameNo: "Magasin redaksjonell",
    vibe: "Store titler, redaksjonell typografi, luft mellom blokker",
    whenToUse: "Når firmanavn skal føles viktige og «fortellingen» teller.",
    folder: "05-magazine-editorial",
  },
  {
    id: "brutalist",
    name: "Brutalist",
    nameNo: "Brutalist",
    vibe: "Tykke kanter, hard kontrast, uppercase",
    whenToUse: "Dristig, uforglemmelig look — skiller seg tydelig fra konkurrenter.",
    folder: "06-brutalist",
  },
  {
    id: "soft-pastel",
    name: "Soft Pastel",
    nameNo: "Myk pastell",
    vibe: "Runde hjørner, milde pastellfarger, vennlig",
    whenToUse: "Mindre «tech», mer innbydende for nye brukere.",
    folder: "07-soft-pastel",
  },
  {
    id: "corporate-blue",
    name: "Corporate Blue",
    nameNo: "Bedrift blå",
    vibe: "Navy header, strukturert tabell, klassisk B2B",
    whenToUse: "Tradisjonell salgsavdeling som vil ha «seriøs» software-følelse.",
    folder: "08-corporate-blue",
  },
  {
    id: "nordic-nature",
    name: "Nordic Nature",
    nameNo: "Nordisk natur",
    vibe: "Skoggrønt, sand, rolig nordisk palett",
    whenToUse: "Norsk merkevare som vil speile natur og tillit.",
    folder: "09-nordic-nature",
  },
  {
    id: "retro-terminal",
    name: "Retro Terminal",
    nameNo: "Retro terminal",
    vibe: "Monospace, grønn tekst på mørk, hacker-80-tall",
    whenToUse: "Spesielt uttrykk for tech-savvy team eller intern demo.",
    folder: "10-retro-terminal",
  },
];
