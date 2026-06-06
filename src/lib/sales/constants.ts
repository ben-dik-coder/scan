export const LEAD_STATUSES = [
  { id: "ny", label: "Ny", color: "bg-slate-500" },
  { id: "kontaktet", label: "Kontaktet", color: "bg-blue-500" },
  { id: "svarte", label: "Svarte", color: "bg-emerald-500" },
  { id: "moete_booket", label: "Møte booket", color: "bg-violet-500" },
  { id: "vunnet", label: "Vunnet", color: "bg-green-600" },
  { id: "tapt", label: "Tapt", color: "bg-red-500" },
  { id: "ikke_interessert", label: "Ikke interessert", color: "bg-orange-500" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["id"];

export const SEQUENCE_STATUSES = [
  "active",
  "completed",
  "paused",
  "replied",
  "unsubscribed",
  "failed",
] as const;

export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];

export const ACTIVITY_TYPES = [
  "email_sent",
  "status_changed",
  "note_added",
  "call",
  "sequence_enrolled",
  "sequence_sent",
  "sequence_paused",
  "follow_up_set",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function statusLabel(status: string): string {
  return LEAD_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function statusColor(status: string): string {
  return LEAD_STATUSES.find((s) => s.id === status)?.color ?? "bg-slate-500";
}

export { DEFAULT_TEMPLATES, DEFAULT_SEQUENCE, DEFAULT_SEQUENCES } from "./default-content";
