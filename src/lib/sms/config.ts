export type SmsProvider = "twilio" | "sveve";

export type SmsConfig = {
  configured: boolean;
  provider: SmsProvider | null;
  from: string | null;
};

export function getSmsConfig(): SmsConfig {
  const sveveUser = process.env.SVEVE_USER?.trim();
  const svevePassword = process.env.SVEVE_PASSWORD?.trim();
  if (sveveUser && svevePassword) {
    return {
      configured: true,
      provider: "sveve",
      from: process.env.SVEVE_FROM?.trim() || "NyLead",
    };
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom = process.env.TWILIO_FROM_NUMBER?.trim();
  if (twilioSid && twilioToken && twilioFrom) {
    return {
      configured: true,
      provider: "twilio",
      from: twilioFrom,
    };
  }

  return { configured: false, provider: null, from: null };
}
