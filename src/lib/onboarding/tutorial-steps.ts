import {
  Building2,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  Mail,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type TutorialStep = {
  id: string;
  phase: string;
  title: string;
  summary: string;
  body: string;
  tips: string[];
  icon: LucideIcon;
  href?: string;
  ctaLabel?: string;
  duration?: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    phase: "Start",
    title: "Velkommen til NyLead",
    summary: "Én tydelig vei fra nye firma til kontakt.",
    body:
      "NyLead samler nye firma fra Brønnøysund, henter kontaktinfo og lar deg jobbe systematisk. Du trenger ikke gjette hva du skal gjøre neste — følg stegene under.",
    tips: [
      "Skann → Kø → Kontakt → Pipeline → Oversikt",
      "Start med å finne firma, ikke med å sende masse e-post",
      "Du kan åpne denne veiledningen igjen når som helst fra menyen",
    ],
    icon: Sparkles,
    duration: "2 min",
  },
  {
    id: "email",
    phase: "Forbered",
    title: "Koble e-posten din",
    summary: "Send fra din egen innboks — ikke fra en generisk adresse.",
    body:
      "Før du sender tilbud, kobler du Gmail eller Outlook. Da ser mottakeren deg som avsender, og svarene kommer rett til deg.",
    tips: [
      "Gå til Innstillinger → Koble e-post",
      "Test med ett firma før du sender til mange",
      "Du kan hoppe over dette steget og komme tilbake senere",
    ],
    icon: Mail,
    href: "/app/innstillinger",
    ctaLabel: "Åpne innstillinger",
    duration: "3 min",
  },
  {
    id: "scan",
    phase: "Steg 1",
    title: "Skann — finn firma",
    summary: "Velg marked, filtrer og sjekk nettside med Google.",
    body:
      "På Skann henter du firma fra Brreg. Velg område og målgruppe, huk av de du vil sjekke, og kjør Google-sjekk for opptil 10 om gangen. Legg de beste i arbeidskøen.",
    tips: [
      "Velg målgruppe øverst (f.eks. alle nye firma)",
      "Bruk «Sjekk topp 10 og legg i kø» for rask start",
      "Filtrer på «uten nettside» når du vil finne gode leads",
    ],
    icon: Building2,
    href: "/app",
    ctaLabel: "Åpne Skann",
    duration: "5 min",
  },
  {
    id: "queue",
    phase: "Steg 2",
    title: "Arbeidskø — jobb én og én",
    summary: "Prioriterte firma, klare til kontakt.",
    body:
      "Arbeidskøen er dagens jobbliste. Her ser du hvem du skal ringe eller sende til — rangert etter score. Ta ett firma om gangen og marker som kontaktet når du er ferdig.",
    tips: [
      "Start med firma som har telefon eller e-post",
      "Bruk fokusmodus for å jobbe uten distraksjon",
      "Marker «Ferdig — kontaktet» når du har tatt kontakt",
    ],
    icon: ListTodo,
    href: "/app/ko",
    ctaLabel: "Åpne arbeidskø",
    duration: "10 min",
  },
  {
    id: "pipeline",
    phase: "Steg 3",
    title: "Pipeline — følg opp",
    summary: "Se status, notater og neste oppfølging.",
    body:
      "Når du har kontaktet et firma, følger du det videre i Pipeline. Dra leads mellom steg, legg notater og sett dato for neste oppfølging.",
    tips: [
      "Bruk pipeline for å ikke miste leads på veien",
      "Sett oppfølgingsdato så du vet hvem du skal ta igjen",
      "Send oppfølging direkte fra lead-detaljer",
    ],
    icon: GitBranch,
    href: "/app/pipeline",
    ctaLabel: "Åpne Pipeline",
    duration: "5 min",
  },
  {
    id: "overview",
    phase: "Steg 4",
    title: "Oversikt — se fremdriften",
    summary: "Tall, neste steg og kontroll på salget.",
    body:
      "Oversikt viser hvor du står: leads, sendte e-poster og hva du bør gjøre nå. Kom hit når du vil se helheten eller finne ditt neste steg.",
    tips: [
      "Sjekk oversikt hver morgen for å vite hva du skal gjøre",
      "«Ditt neste steg» peker deg videre automatisk",
      "Åpne veiledningen igjen fra menyen når du trenger det",
    ],
    icon: LayoutDashboard,
    href: "/app/oversikt",
    ctaLabel: "Åpne Oversikt",
    duration: "2 min",
  },
];
