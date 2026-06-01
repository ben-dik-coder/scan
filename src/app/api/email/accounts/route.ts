import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listMailAccounts, deleteMailAccount } from "@/lib/email/oauth/accounts";
import type { MailProvider } from "@/lib/email/oauth/config";
import {
  googleOAuthConfigured,
  microsoftOAuthConfigured,
} from "@/lib/email/oauth/config";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await listMailAccounts(user.id);
  return NextResponse.json({
    accounts,
    providers: {
      google: googleOAuthConfigured(),
      microsoft: microsoftOAuthConfigured(),
    },
  });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") as MailProvider | null;
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.json({ error: "Ugyldig provider" }, { status: 400 });
  }

  await deleteMailAccount(user.id, provider);
  return NextResponse.json({ ok: true });
}
