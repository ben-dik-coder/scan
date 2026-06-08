export type ProfileRole = "user" | "admin";

export type PlanId = "nylead";

/** Eldre planer i databasen — behandles som NyLead i appen */
export type LegacyPlanId = "start" | "pro" | "agency";

export type StoredPlanId = PlanId | LegacyPlanId;

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unpaid";

export type Profile = {
  id: string;
  role: ProfileRole;
  company_name: string | null;
  plan: StoredPlanId | null;
  subscription_status: SubscriptionStatus | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type Company = {
  orgnr: string;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  municipality_code: string | null;
  municipality_name: string | null;
  /** Poststed fra Brreg (ofte mer presist enn kommune i sosialsøk) */
  city: string | null;
  /** Offisiell hjemmeside fra Brreg */
  website: string | null;
  industry_code: string | null;
  /** Brreg naeringskode1.beskrivelse — kun live Brreg, ikke lagret i DB */
  industry_description?: string | null;
  registered_at: string | null;
  has_email: boolean;
  email_is_generic: boolean;
  brreg_updated_at: string | null;
  daglig_leder: string | null;
  contact_override?: {
    orgnr: string;
    mobile: string | null;
    phone: string | null;
    owner_name: string | null;
    source: string | null;
    notes: string | null;
    updated_at: string;
  } | null;
  created_at: string;
  updated_at: string;
};

export type SyncState = {
  key: string;
  last_sync: string | null;
  cursor: string | null;
  metadata: Record<string, unknown> | null;
};

export type EmailCampaign = {
  id: string;
  user_id: string;
  subject: string;
  subject_b: string | null;
  body: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

export type EmailCampaignRecipient = {
  id: string;
  campaign_id: string;
  orgnr: string;
  email: string;
  status: CampaignRecipientStatus;
  error_message: string | null;
  ab_variant: "a" | "b" | null;
  sent_at: string | null;
  created_at: string;
};

export type CampaignListItem = EmailCampaign & {
  recipient_count: number;
};

export type CampaignRecipientDetail = {
  id: string;
  orgnr: string;
  companyName: string;
  email: string;
  status: CampaignRecipientStatus;
  error_message: string | null;
  ab_variant: "a" | "b" | null;
  sent_at: string | null;
};

export type CampaignDetail = {
  campaign: EmailCampaign;
  recipients: CampaignRecipientDetail[];
};

export type UserSettings = {
  user_id: string;
  webhook_url: string | null;
  weekly_alert_enabled: boolean;
  weekly_alert_filters: Record<string, unknown>;
  weekly_alert_last_sent_at: string | null;
  trial_nudges_sent?: Record<string, boolean>;
  created_at: string;
  updated_at: string;
};

export type CampaignRecipientStatus =
  | "pending"
  | "sent"
  | "failed"
  | "unsubscribed"
  | "blocked";

export type LeadStatus =
  | "ny"
  | "kontaktet"
  | "svarte"
  | "moete_booket"
  | "vunnet"
  | "tapt"
  | "ikke_interessert";

export type UserLead = {
  user_id: string;
  orgnr: string;
  status: LeadStatus;
  score: number;
  notes: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  /** Satt når bruker eksplisitt legger lead i arbeidskø */
  queued_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailTemplate = {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailSequence = {
  id: string;
  user_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailSequenceStep = {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_days: number;
  subject: string;
  body: string;
  created_at: string;
};

export type SequenceStatus =
  | "active"
  | "completed"
  | "paused"
  | "replied"
  | "unsubscribed"
  | "failed";

export type SequenceEnrollment = {
  id: string;
  user_id: string;
  sequence_id: string;
  orgnr: string;
  current_step: number;
  status: SequenceStatus;
  enrolled_at: string;
  next_send_at: string | null;
  last_sent_at: string | null;
};

export type ActivityType =
  | "email_sent"
  | "status_changed"
  | "note_added"
  | "call"
  | "sequence_enrolled"
  | "sequence_sent"
  | "sequence_paused"
  | "follow_up_set";

export type LeadActivity = {
  id: string;
  user_id: string;
  orgnr: string;
  activity_type: ActivityType;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type SavedList = {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, unknown>;
  created_at: string;
};

export type AgentConversationStatus = "active" | "archived";

export type AgentConversation = {
  id: string;
  user_id: string;
  title: string;
  status: AgentConversationStatus;
  created_at: string;
  updated_at: string;
};

export type AgentMessageRole = "user" | "assistant" | "tool";

export type AgentMessage = {
  id: string;
  conversation_id: string;
  role: AgentMessageRole;
  content: string;
  tool_calls: Record<string, unknown> | null;
  tool_name: string | null;
  created_at: string;
};

export type AgentRunStatus = "running" | "done" | "failed";

export type AgentRun = {
  id: string;
  conversation_id: string;
  user_id: string;
  status: AgentRunStatus;
  params: Record<string, unknown>;
  progress: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyWithLead = Company & {
  user_lead?: UserLead | null;
};
