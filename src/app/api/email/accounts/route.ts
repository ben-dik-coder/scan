import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  deleteMailAccount,
  deleteMailAccountById,
  getDefaultMailAccountId,
  listMailAccounts,
  setDefaultMailAccountId,
} from "@/lib/email/oauth/accounts";
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

  const [accounts, defaultMailAccountId] = await Promise.all([
    listMailAccounts(user.id),
    getDefaultMailAccountId(user.id),
  ]);

  const validDefault =
    defaultMailAccountId &&
    accounts.some((a) => a.id === defaultMailAccountId)
      ? defaultMailAccountId
      : accounts[0]?.id ?? null;

  return NextResponse.json({
    accounts,
    defaultMailAccountId: validDefault,
    providers: {
      google: googleOAuthConfigured(),
      microsoft: microsoftOAuthConfigured(),
    },
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const accountId =
    typeof body.defaultAccountId === "string" ? body.defaultAccountId.trim() : "";

  if (!accountId) {
    return NextResponse.json({ error: "Velg en konto" }, { status: 400 });
  }

  const accounts = await listMailAccounts(user.id);
  if (!accounts.some((a) => a.id === accountId)) {
    return NextResponse.json({ error: "Ugyldig konto" }, { status: 400 });
  }

  await setDefaultMailAccountId(user.id, accountId);
  return NextResponse.json({ ok: true, defaultMailAccountId: accountId });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("id");
  if (accountId) {
    await deleteMailAccountById(user.id, accountId);
    return NextResponse.json({ ok: true });
  }

  const provider = searchParams.get("provider") as MailProvider | null;
  if (provider !== "google" && provider !== "microsoft" && provider !== "smtp") {
    return NextResponse.json({ error: "Ugyldig provider eller id" }, { status: 400 });
  }

  await deleteMailAccount(user.id, provider);
  return NextResponse.json({ ok: true });
}
