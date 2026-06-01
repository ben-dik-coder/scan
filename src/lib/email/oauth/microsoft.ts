import { redirectUri, MICROSOFT_SCOPES, type MailProvider } from "./config";

const PROVIDER: MailProvider = "microsoft";
const TENANT = process.env.MICROSOFT_TENANT_ID ?? "common";

function tokenUrl() {
  return `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
}

function authUrlBase() {
  return `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
}

export function microsoftAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    redirect_uri: redirectUri(PROVIDER),
    response_type: "code",
    scope: MICROSOFT_SCOPES,
    response_mode: "query",
    state,
  });
  return `${authUrlBase()}?${params}`;
}

async function tokenRequest(body: URLSearchParams) {
  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.error_description ?? data.error ?? "Microsoft token-feil"
    );
  }
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

export async function exchangeMicrosoftCode(code: string) {
  return tokenRequest(
    new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri: redirectUri(PROVIDER),
      grant_type: "authorization_code",
      code,
    })
  );
}

export async function refreshMicrosoftAccessToken(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    })
  );
}

export async function fetchMicrosoftEmail(accessToken: string) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  const email = data.mail ?? data.userPrincipalName;
  if (!res.ok || !email) {
    throw new Error("Kunne ikke hente Outlook-adresse");
  }
  return email as string;
}

export async function sendViaMicrosoft(input: {
  accessToken: string;
  to: string;
  subject: string;
  html: string;
}) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: { contentType: "HTML", content: input.html },
        toRecipients: [{ emailAddress: { address: input.to } }],
      },
      saveToSentItems: true,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      data.error?.message ?? "Outlook kunne ikke sende e-post"
    );
  }
}
