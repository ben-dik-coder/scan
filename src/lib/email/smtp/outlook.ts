import nodemailer from "nodemailer";

const OUTLOOK_SMTP = {
  host: "smtp-mail.outlook.com",
  port: 587,
  secure: false,
  requireTLS: true,
} as const;

type SmtpError = Error & {
  code?: string;
  response?: string;
  responseCode?: number;
};

function logSmtpFailure(context: string, email: string, err: unknown) {
  const smtpErr = err as SmtpError;
  console.error(`[smtp/outlook] ${context} failed`, {
    email,
    code: smtpErr.code,
    responseCode: smtpErr.responseCode,
    response: smtpErr.response,
    message: smtpErr.message,
  });
}

function mapOutlookSmtpError(err: unknown, mode: "verify" | "send"): never {
  const smtpErr = err as SmtpError;
  const msg = smtpErr.message ?? "SMTP-feil";
  const response = smtpErr.response ?? msg;

  if (/basic authentication is disabled|SmtpClientAuthentication is disabled/i.test(response)) {
    throw new Error(
      "Microsoft har slått av SMTP med app-passord for denne kontoen. " +
        "Bruk «Outlook (OAuth)» i stedet, eller en annen e-postleverandør (f.eks. Gmail)."
    );
  }

  if (/535|534|authentication/i.test(response)) {
    throw new Error(
      mode === "verify"
        ? "Feil e-post eller app-passord. Sjekk at 2FA er på og at du bruker et nytt app-passord fra account.microsoft.com/security."
        : "Feil e-post eller app-passord. Sjekk at du bruker app-passord (ikke vanlig passord)."
    );
  }

  throw new Error(
    mode === "verify" ? `Kunne ikke koble til Outlook: ${msg}` : `Outlook SMTP: ${msg}`
  );
}

export async function sendViaOutlookSmtp(input: {
  email: string;
  appPassword: string;
  to: string;
  subject: string;
  html: string;
}) {
  const transporter = nodemailer.createTransport({
    ...OUTLOOK_SMTP,
    auth: {
      user: input.email,
      pass: input.appPassword,
    },
  });

  try {
    await transporter.sendMail({
      from: input.email,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  } catch (err) {
    logSmtpFailure("send", input.email, err);
    mapOutlookSmtpError(err, "send");
  } finally {
    transporter.close();
  }
}

export async function verifyOutlookSmtpCredentials(input: {
  email: string;
  appPassword: string;
}) {
  const transporter = nodemailer.createTransport({
    ...OUTLOOK_SMTP,
    auth: {
      user: input.email,
      pass: input.appPassword,
    },
  });

  try {
    await transporter.verify();
  } catch (err) {
    logSmtpFailure("verify", input.email, err);
    mapOutlookSmtpError(err, "verify");
  } finally {
    transporter.close();
  }
}
