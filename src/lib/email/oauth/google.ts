import {
  GOOGLE_SCOPES,
  redirectUri,
  type MailProvider,
} from "./config";

const PROVIDER: MailProvider = "google";

export function googleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(PROVIDER),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(PROVIDER),
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? "Google token-feil");
  }
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? "Google refresh-feil");
  }
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

export async function fetchGoogleEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok || !data.email) {
    throw new Error("Kunne ikke hente Gmail-adresse");
  }
  return data.email as string;
}

function encodeMimeRaw(mime: string) {
  return Buffer.from(mime)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendViaGmail(input: {
  accessToken: string;
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
}) {
  const mime = [
    `From: ${input.fromEmail}`,
    `To: ${input.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    input.html,
  ].join("\r\n");

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodeMimeRaw(mime) }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.error?.message ?? data.error ?? "Gmail kunne ikke sende e-post"
    );
  }
}
