import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken, encryptToken } from "./crypto";
import type { MailProvider } from "./config";
import { refreshGoogleAccessToken } from "./google";
import { refreshMicrosoftAccessToken } from "./microsoft";

const PROVIDER_ORDER: MailProvider[] = ["google", "smtp", "microsoft"];

export type MailAccount = {
  id: string;
  provider: MailProvider;
  email: string;
};

export async function listMailAccounts(userId: string): Promise<MailAccount[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("user_mail_accounts")
    .select("id, provider, email")
    .eq("user_id", userId);
  return (data ?? []) as MailAccount[];
}

export async function getPreferredMailAccount(
  userId: string,
  preferred?: MailProvider
): Promise<(MailAccount & { accessToken: string }) | null> {
  const accounts = await listMailAccounts(userId);
  if (accounts.length === 0) return null;

  const order: MailProvider[] = preferred
    ? [preferred, ...PROVIDER_ORDER.filter((p) => p !== preferred)]
    : PROVIDER_ORDER;

  for (const provider of order) {
    const acc = accounts.find((a) => a.provider === provider);
    if (!acc) continue;
    const token = await getValidAccessToken(userId, provider);
    if (token) return { ...acc, accessToken: token };
  }
  return null;
}

export async function saveMailAccount(
  userId: string,
  provider: MailProvider,
  email: string,
  accessToken: string,
  refreshToken: string | null,
  expiresInSec?: number
) {
  const supabase = createServiceClient();
  const expires_at = expiresInSec
    ? new Date(Date.now() + expiresInSec * 1000).toISOString()
    : null;

  const { error } = await supabase.from("user_mail_accounts").upsert(
    {
      user_id: userId,
      provider,
      email,
      access_token_enc: encryptToken(accessToken),
      refresh_token_enc: refreshToken ? encryptToken(refreshToken) : null,
      expires_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  if (error) throw new Error(error.message);
}

export async function saveSmtpAccount(
  userId: string,
  email: string,
  appPassword: string
) {
  await saveMailAccount(userId, "smtp", email, appPassword, null);
}

export async function deleteMailAccount(userId: string, provider: MailProvider) {
  const supabase = createServiceClient();
  await supabase
    .from("user_mail_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
}

async function getValidAccessToken(
  userId: string,
  provider: MailProvider
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("user_mail_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data) return null;

  if (provider === "smtp" && data.access_token_enc) {
    try {
      return decryptToken(data.access_token_enc);
    } catch {
      return null;
    }
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  const stillValid = expiresAt > Date.now() + 60_000;

  if (stillValid && data.access_token_enc) {
    try {
      return decryptToken(data.access_token_enc);
    } catch {
      return null;
    }
  }

  if (!data.refresh_token_enc) return null;

  let refreshToken: string;
  try {
    refreshToken = decryptToken(data.refresh_token_enc);
  } catch {
    return null;
  }

  try {
    const refreshed =
      provider === "google"
        ? await refreshGoogleAccessToken(refreshToken)
        : await refreshMicrosoftAccessToken(refreshToken);

    await saveMailAccount(
      userId,
      provider,
      data.email,
      refreshed.access_token,
      refreshed.refresh_token ?? refreshToken,
      refreshed.expires_in
    );
    return refreshed.access_token;
  } catch {
    return null;
  }
}
