const SESSION_KEY = "nylead-sms-session-v1";

type SmsSession = {
  date: string;
  sent: number;
  skipped: number;
  meetings: number;
  contacted: number;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readSession(): SmsSession {
  if (typeof window === "undefined") {
    return { date: todayKey(), sent: 0, skipped: 0, meetings: 0, contacted: 0 };
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { date: todayKey(), sent: 0, skipped: 0, meetings: 0, contacted: 0 };
    const parsed = JSON.parse(raw) as Partial<SmsSession>;
    if (parsed.date !== todayKey()) {
      return { date: todayKey(), sent: 0, skipped: 0, meetings: 0, contacted: 0 };
    }
    return {
      date: todayKey(),
      sent: typeof parsed.sent === "number" ? parsed.sent : 0,
      skipped: typeof parsed.skipped === "number" ? parsed.skipped : 0,
      meetings: typeof parsed.meetings === "number" ? parsed.meetings : 0,
      contacted: typeof parsed.contacted === "number" ? parsed.contacted : 0,
    };
  } catch {
    return { date: todayKey(), sent: 0, skipped: 0, meetings: 0, contacted: 0 };
  }
}

function writeSession(session: SmsSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSmsSessionStats(): SmsSession {
  return readSession();
}

export function recordSmsOutcome(
  outcome: "sent" | "skipped" | "meeting" | "contacted"
): SmsSession {
  const session = readSession();
  if (outcome === "sent") session.sent += 1;
  if (outcome === "skipped") session.skipped += 1;
  if (outcome === "meeting") session.meetings += 1;
  if (outcome === "contacted") session.contacted += 1;
  writeSession(session);
  return session;
}
