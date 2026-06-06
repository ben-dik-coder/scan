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

export type MailAccountPreference =
  | MailProvider
  | {
      accountId?: string;
      provider?: MailProvider;
    };

function normalizePreference(
  preferred?: MailAccountPreference
): { accountId?: string; provider?: MailProvider } | undefined {
  if (!preferred) return undefined;
  if (typeof preferred === "string") return { provider: preferred };
  return preferred;
}

export async function listMailAccounts(userId: string): Promise<MailAccount[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("user_mail_accounts")
    .select("id, provider, email")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as MailAccount[];
}

export async function getPreferredMailAccount(
  userId: string,
  preferred?: MailAccountPreference
): Promise<(MailAccount & { accessToken: string }) | null> {
  const accounts = await listMailAccounts(userId);
  if (accounts.length === 0) return null;

  const pref = normalizePreference(preferred);

  if (pref?.accountId) {
    const acc = accounts.find((a) => a.id === pref.accountId);
    if (!acc) return null;
    const token = await getValidAccessToken(userId, acc.id);
    return token ? { ...acc, accessToken: token } : null;
  }

  const order: MailProvider[] = pref?.provider
    ? [pref.provider, ...PROVIDER_ORDER.filter((p) => p !== pref.provider)]
    : PROVIDER_ORDER;

  for (const provider of order) {
    const acc = accounts.find((a) => a.provider === provider);
    if (!acc) continue;
    const token = await getValidAccessToken(userId, acc.id);
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
      email: email.trim().toLowerCase(),
      access_token_enc: encryptToken(accessToken),
      refresh_token_enc: refreshToken ? encryptToken(refreshToken) : null,
      expires_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,email" }
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

export async function deleteMailAccountById(userId: string, accountId: string) {
  const supabase = createServiceClient();
  await supabase
    .from("user_mail_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("id", accountId);
}

async function getValidAccessToken(
  userId: string,
  accountId: string
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("user_mail_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", accountId)
    .maybeSingle();

  if (error || !data) return null;

  const provider = data.provider as MailProvider;

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
