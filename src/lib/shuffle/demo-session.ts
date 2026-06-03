const DEMO_SESSION_KEY = "nylead-demo-shuffle-session";

export function getDemoShuffleSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = sessionStorage.getItem(DEMO_SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(DEMO_SESSION_KEY, id);
  }
  return id;
}
