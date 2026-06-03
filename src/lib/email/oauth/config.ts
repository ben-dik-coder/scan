export type MailProvider = "google" | "microsoft" | "smtp";

export function appUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const fromVercel = process.env.VERCEL_URL?.trim();
  const base =
    fromEnv ||
    (fromVercel ? `https://${fromVercel}` : "http://localhost:3000");
  return base.replace(/\/$/, "");
}

export function redirectUri(provider: MailProvider) {
  return `${appUrl()}/api/email/callback/${provider}`;
}

export function googleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function microsoftOAuthConfigured() {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID?.trim() &&
      process.env.MICROSOFT_CLIENT_SECRET?.trim()
  );
}

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

export const MICROSOFT_SCOPES = [
  "offline_access",
  "openid",
  "email",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read",
].join(" ");
