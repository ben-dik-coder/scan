import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getEntitlements, requireFeature } from "@/lib/billing/entitlements";
import {
  appUrl,
  googleOAuthConfigured,
  microsoftOAuthConfigured,
  type MailProvider,
} from "@/lib/email/oauth/config";
import { googleAuthUrl } from "@/lib/email/oauth/google";
import { microsoftAuthUrl } from "@/lib/email/oauth/microsoft";
import { newOAuthState } from "@/lib/email/oauth/state";

type Params = { params: { provider: string } };

export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(
      `${appUrl()}/innlogging?redirect=${encodeURIComponent("/app/innstillinger")}`
    );
  }

  const entitlements = await getEntitlements(user.id);
  const emailError = requireFeature(entitlements, "email");
  if (emailError) {
    return NextResponse.redirect(
      `${appUrl()}/app/abonnement?error=upgrade_email`
    );
  }

  const provider = params.provider as MailProvider;
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.json({ error: "Ugyldig provider" }, { status: 400 });
  }

  if (provider === "google" && !googleOAuthConfigured()) {
    return NextResponse.redirect(
      `${appUrl()}/app/innstillinger?error=google_not_configured`
    );
  }
  if (provider === "microsoft" && !microsoftOAuthConfigured()) {
    return NextResponse.redirect(
      `${appUrl()}/app/innstillinger?error=microsoft_not_configured`
    );
  }

  try {
    const state = newOAuthState(user.id, provider);
    const url =
      provider === "google" ? googleAuthUrl(state) : microsoftAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth-feil";
    return NextResponse.redirect(
      `${appUrl()}/app/innstillinger?error=${encodeURIComponent(msg)}`
    );
  }
}
