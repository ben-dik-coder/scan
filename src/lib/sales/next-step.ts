export type NextStepPhase =
  | "connect_email"
  | "scan"
  | "work_queue"
  | "pipeline"
  | "overview";

export type NextStep = {
  phase: NextStepPhase;
  title: string;
  body: string;
  cta: { href: string; label: string };
  progress: { current: number; total: number };
};

export type NextStepInput = {
  emailConnected: boolean;
  queuedCount: number;
  queuedNyCount: number;
  dueFollowUps: number;
  totalLeads: number;
  totalSent: number;
};

export const JOURNEY_STEP_LABELS = [
  "Skann",
  "Kø",
  "Kontakt",
  "Pipeline",
  "Oversikt",
] as const;

export function phaseToProgressIndex(phase: NextStepPhase): number {
  switch (phase) {
    case "connect_email":
      return 0;
    case "scan":
      return 1;
    case "work_queue":
      return 3;
    case "pipeline":
      return 4;
    case "overview":
      return 5;
    default:
      return 1;
  }
}

export function computeNextStep(input: NextStepInput): NextStep {
  const { emailConnected, queuedCount, queuedNyCount, dueFollowUps } = input;

  if (!emailConnected) {
    return {
      phase: "connect_email",
      title: "Koble e-post først",
      body: "Koble Gmail eller Outlook før du kan sende til firma.",
      cta: { href: "/app/innstillinger", label: "Koble e-post" },
      progress: { current: 0, total: 5 },
    };
  }

  if (queuedCount === 0) {
    return {
      phase: "scan",
      title: "Finn firma på Skann",
      body: "Velg firma, sjekk nettside og legg dem i arbeidskøen.",
      cta: { href: "/app", label: "Gå til Skann" },
      progress: { current: 1, total: 5 },
    };
  }

  if (queuedNyCount > 0) {
    const n = queuedNyCount;
    return {
      phase: "work_queue",
      title: n === 1 ? "Du har 1 i køen" : `Du har ${n} i køen`,
      body:
        n === 1
          ? "Ét firma venter — ta kontakt nå."
          : `${n} firma venter — jobb én og én i arbeidskøen.`,
      cta: { href: "/app/ko", label: "Jobb i arbeidskøen" },
      progress: { current: 3, total: 5 },
    };
  }

  if (dueFollowUps > 0) {
    const n = dueFollowUps;
    return {
      phase: "pipeline",
      title: n === 1 ? "1 oppfølging i dag" : `${n} oppfølginger i dag`,
      body: "Sjekk Pipeline og følg opp leads du har kontaktet.",
      cta: { href: "/app/pipeline", label: "Sjekk Pipeline" },
      progress: { current: 4, total: 5 },
    };
  }

  return {
    phase: "overview",
    title: "Se fremdriften din",
    body: "Du er ajour — sjekk oversikten eller legg flere firma i kø fra Skann.",
    cta: { href: "/app/oversikt", label: "Se oversikt" },
    progress: { current: 5, total: 5 },
  };
}
