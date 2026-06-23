const SESSION_KEY = "nylead-ring-session-v1";

type RingSession = {
  date: string;
  dialed: number;
  answered: number;
  meetings: number;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readSession(): RingSession {
  if (typeof window === "undefined") {
    return { date: todayKey(), dialed: 0, answered: 0, meetings: 0 };
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { date: todayKey(), dialed: 0, answered: 0, meetings: 0 };
    const parsed = JSON.parse(raw) as Partial<RingSession>;
    if (parsed.date !== todayKey()) {
      return { date: todayKey(), dialed: 0, answered: 0, meetings: 0 };
    }
    return {
      date: todayKey(),
      dialed: typeof parsed.dialed === "number" ? parsed.dialed : 0,
      answered: typeof parsed.answered === "number" ? parsed.answered : 0,
      meetings: typeof parsed.meetings === "number" ? parsed.meetings : 0,
    };
  } catch {
    return { date: todayKey(), dialed: 0, answered: 0, meetings: 0 };
  }
}

function writeSession(session: RingSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getRingSessionStats(): RingSession {
  return readSession();
}

export function recordRingOutcome(
  outcome: "dialed" | "answered" | "meeting"
): RingSession {
  const session = readSession();
  if (outcome === "dialed") session.dialed += 1;
  if (outcome === "answered") {
    session.dialed += 1;
    session.answered += 1;
  }
  if (outcome === "meeting") {
    session.dialed += 1;
    session.meetings += 1;
  }
  writeSession(session);
  return session;
}
