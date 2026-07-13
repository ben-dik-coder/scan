import type { LeadStatus } from "@/types/database";

/** Navngitt arbeidskø — brukeren velger hvem som skal ringes. */
export type WorkQueue = {
  id: string;
  userId: string;
  name: string;
  sourceListId: string | null;
  isDefault: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type QueueItem = {
  id: string;
  queueId: string;
  orgnr: string;
  sortOrder: number;
  pinned: boolean;
  snoozeUntil: string | null;
};

/** Firma klar til ring/SMS/e-post — bygget fra kø eller liste. */
export type DialLead = {
  orgnr: string;
  name: string;
  email: string | null;
  phone: string | null;
  municipalityName: string | null;
  registeredAt: string | null;
  status: LeadStatus | string;
  queueScore: number;
  daysSinceRegistration: number | null;
  hasWebsite: boolean | null;
  websiteKind: string | null;
  dagligLeder: string | null;
  pinned: boolean;
  sortOrder: number;
};

export type DialSource =
  | { type: "queue"; queueId: string }
  | { type: "list"; listId: string };

export type DialChannel = "ring" | "sms";
