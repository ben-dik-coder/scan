import type { MailProvider } from "./oauth/config";
import { getPreferredMailAccount } from "./oauth/accounts";
import { sendViaGmail } from "./oauth/google";
import { sendViaMicrosoft } from "./oauth/microsoft";

export async function sendEmailViaUserAccount(
  userId: string,
  input: {
    to: string;
    subject: string;
    html: string;
    preferredProvider?: MailProvider;
  }
): Promise<{ fromEmail: string; provider: MailProvider }> {
  const account = await getPreferredMailAccount(userId, input.preferredProvider);
  if (!account) {
    throw new Error(
      "Ingen e-post koblet. Gå til Innstillinger og koble Gmail eller Outlook."
    );
  }

  if (account.provider === "google") {
    await sendViaGmail({
      accessToken: account.accessToken,
      fromEmail: account.email,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  } else {
    await sendViaMicrosoft({
      accessToken: account.accessToken,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  }

  return { fromEmail: account.email, provider: account.provider };
}
