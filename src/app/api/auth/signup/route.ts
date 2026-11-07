import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

function appUrl(req: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured?.startsWith("http")) return configured.replace(/\/$/, "");
  const origin = new URL(req.url).origin;
  return origin.replace(/\/$/, "");
}

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

/**
 * Signup that bypasses broken/hung Supabase custom SMTP.
 * Creates the user + confirmation link via Admin API, sends mail with Resend.
 * Scope: NyLead (umsimryvoifrjmkaelup) only.
 */
export async function POST(request: Request) {
  let body: {
    email?: string;
    password?: string;
    companyName?: string | null;
    next?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const companyName = body.companyName?.trim() || null;
  const nextPath =
    body.next?.startsWith("/") && !body.next.startsWith("//")
      ? body.next
      : "/app/oversikt";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Skriv inn en gyldig e-post." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Passordet må være minst 6 tegn." },
      { status: 400 },
    );
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json(
      { error: "E-post er ikke konfigurert (RESEND_API_KEY mangler)." },
      { status: 503 },
    );
  }

  const supabase = createServiceClient();
  const redirectTo = `${appUrl(request)}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      data: { company_name: companyName },
      redirectTo,
    },
  });

  if (error) {
    const msg = error.message || "Kunne ikke opprette konto.";
    const lower = msg.toLowerCase();
    if (lower.includes("already") || lower.includes("registered")) {
      return NextResponse.json(
        { error: "Denne e-posten er allerede registrert. Logg inn i stedet." },
        { status: 409 },
      );
    }
    console.error("[api/auth/signup] generateLink", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const actionLink =
    data.properties?.action_link ||
    (data as { action_link?: string }).action_link ||
    "";

  if (!actionLink) {
    console.error("[api/auth/signup] missing action_link", data);
    return NextResponse.json(
      { error: "Kunne ikke lage aktiveringslenke. Prøv igjen." },
      { status: 500 },
    );
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "NyLead <onboarding@resend.dev>";

  const { error: sendError } = await resend.emails.send({
    from,
    to: email,
    subject: "Bekreft kontoen din hos NyLead",
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.55;max-width:520px;color:#111">
        <h1 style="font-size:22px;margin:0 0 12px">Bekreft e-posten din</h1>
        <p style="margin:0 0 12px;color:#333">
          Trykk knappen under for å aktivere NyLead-kontoen din.
        </p>
        <p style="margin:0 0 20px">
          <a href="${actionLink}"
             style="display:inline-block;background:#10b981;color:#000;font-weight:600;text-decoration:none;padding:12px 18px;border-radius:10px">
            Aktiver konto
          </a>
        </p>
        <p style="margin:0;font-size:12px;color:#888">
          Hvis du ikke opprettet en konto, kan du se bort fra denne e-posten.
        </p>
      </div>
    `,
  });

  if (sendError) {
    console.error("[api/auth/signup] resend", sendError);
    return NextResponse.json(
      {
        error:
          "Kontoen ble laget, men e-post feilet. Prøv igjen om litt, eller sjekk at Resend godtar mottakeren.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, email });
}
