import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { saveSmtpAccount } from "@/lib/email/oauth/accounts";
import { verifyOutlookSmtpCredentials } from "@/lib/email/smtp/outlook";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const appPassword =
    typeof body.appPassword === "string"
      ? body.appPassword.replace(/[\s-]/g, "")
      : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Ugyldig e-postadresse" }, { status: 400 });
  }

  if (!appPassword || appPassword.length < 8) {
    return NextResponse.json(
      { error: "App-passord mangler eller er for kort" },
      { status: 400 }
    );
  }

  try {
    await verifyOutlookSmtpCredentials({ email, appPassword });
    await saveSmtpAccount(user.id, email, appPassword);
    return NextResponse.json({ ok: true, email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke koble til Outlook";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
