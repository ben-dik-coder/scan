import { NextResponse } from "next/server";
import {
  appUrl,
  type MailProvider,
} from "@/lib/email/oauth/config";
import { saveMailAccount } from "@/lib/email/oauth/accounts";
import {
  exchangeGoogleCode,
  fetchGoogleEmail,
} from "@/lib/email/oauth/google";
import {
  exchangeMicrosoftCode,
  fetchMicrosoftEmail,
} from "@/lib/email/oauth/microsoft";
import { verifyOAuthState } from "@/lib/email/oauth/state";

type Params = { params: { provider: string } };

export async function GET(request: Request, { params }: Params) {
  const provider = params.provider as MailProvider;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const settingsUrl = `${appUrl()}/app/innstillinger`;

  if (oauthError) {
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent(oauthError)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?error=missing_code`);
  }

  const parsed = verifyOAuthState(state);
  if (!parsed || parsed.provider !== provider) {
    return NextResponse.redirect(`${settingsUrl}?error=invalid_state`);
  }

  try {
    if (provider === "google") {
      const tokens = await exchangeGoogleCode(code);
      const email = await fetchGoogleEmail(tokens.access_token);
      await saveMailAccount(
        parsed.userId,
        "google",
        email,
        tokens.access_token,
        tokens.refresh_token ?? null,
        tokens.expires_in
      );
    } else if (provider === "microsoft") {
      const tokens = await exchangeMicrosoftCode(code);
      const email = await fetchMicrosoftEmail(tokens.access_token);
      await saveMailAccount(
        parsed.userId,
        "microsoft",
        email,
        tokens.access_token,
        tokens.refresh_token ?? null,
        tokens.expires_in
      );
    } else {
      return NextResponse.redirect(`${settingsUrl}?error=invalid_provider`);
    }

    return NextResponse.redirect(`${settingsUrl}?connected=${provider}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Kunne ikke koble e-post";
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent(msg)}`
    );
  }
}
