import { getSmsConfig } from "@/lib/sms/config";
import { normalizeSmsPhone } from "@/lib/sms/normalize-phone";

export async function sendSmsMessage(to: string, body: string): Promise<{ id: string }> {
  const message = body.trim();
  if (!message) throw new Error("Meldingen er tom");
  if (message.length > 1600) throw new Error("Meldingen er for lang (maks 1600 tegn)");

  const config = getSmsConfig();
  if (!config.configured || !config.provider) {
    throw new Error(
      "SMS er ikke satt opp. Legg inn SVEVE_USER/SVEVE_PASSWORD eller Twilio-nøkler i miljøvariabler."
    );
  }

  const normalizedTo = normalizeSmsPhone(to);

  if (config.provider === "sveve") {
    return sendViaSveve(normalizedTo, message, config.from!);
  }

  return sendViaTwilio(normalizedTo, message, config.from!);
}

async function sendViaSveve(to: string, msg: string, from: string): Promise<{ id: string }> {
  const user = process.env.SVEVE_USER!.trim();
  const passwd = process.env.SVEVE_PASSWORD!.trim();

  const params = new URLSearchParams({
    user,
    passwd,
    to: to.replace(/^\+/, ""),
    msg,
    from,
    f: "json",
  });

  const res = await fetch("https://sveve.no/SMS/SendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    next: { revalidate: 0 },
  });

  const text = await res.text();
  let data: { response?: { msgOkCount?: number; errors?: Array<{ message?: string }> } };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`Sveve feilet: ${text.slice(0, 200)}`);
  }

  const ok = (data.response?.msgOkCount ?? 0) > 0;
  if (!ok) {
    const errMsg =
      data.response?.errors?.[0]?.message ?? text.slice(0, 200) ?? "Ukjent Sveve-feil";
    throw new Error(errMsg);
  }

  return { id: `sveve-${Date.now()}` };
}

async function sendViaTwilio(to: string, body: string, from: string): Promise<{ id: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN!.trim();
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
      next: { revalidate: 0 },
    }
  );

  const data = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? `Twilio feilet (${res.status})`);
  }

  return { id: data.sid ?? `twilio-${Date.now()}` };
}
