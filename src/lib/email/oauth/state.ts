import { createHmac, randomBytes } from "crypto";
import type { MailProvider } from "./config";

type OAuthState = {
  userId: string;
  provider: MailProvider;
  nonce: string;
};

function stateSecret() {
  const s = process.env.EMAIL_TOKEN_SECRET ?? process.env.CRON_SECRET;
  if (!s) throw new Error("EMAIL_TOKEN_SECRET eller CRON_SECRET må settes");
  return s;
}

export function signOAuthState(payload: OAuthState): string {
  const json = JSON.stringify(payload);
  const sig = createHmac("sha256", stateSecret()).update(json).digest("base64url");
  return `${Buffer.from(json).toString("base64url")}.${sig}`;
}

export function verifyOAuthState(token: string): OAuthState | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const json = Buffer.from(body, "base64url").toString("utf8");
  const expected = createHmac("sha256", stateSecret()).update(json).digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(json) as OAuthState;
  } catch {
    return null;
  }
}

export function newOAuthState(userId: string, provider: MailProvider): string {
  return signOAuthState({
    userId,
    provider,
    nonce: randomBytes(16).toString("hex"),
  });
}
