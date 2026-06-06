import type { EmailAttachment } from "./attachments";

function encodeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
}

function wrapBase64(base64: string, lineLength = 76): string {
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += lineLength) {
    chunks.push(base64.slice(i, i + lineLength));
  }
  return chunks.join("\r\n");
}

function sanitizeFilename(name: string) {
  return name.replace(/[\r\n"]/g, "_");
}

export function buildHtmlMime(input: {
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): string {
  const attachments = input.attachments ?? [];
  const subject = encodeSubject(input.subject);

  if (attachments.length === 0) {
    return [
      `From: ${input.fromEmail}`,
      `To: ${input.to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "",
      input.html,
    ].join("\r\n");
  }

  const boundary = `nylead_${Date.now().toString(36)}`;
  const lines = [
    `From: ${input.fromEmail}`,
    `To: ${input.to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.html,
  ];

  for (const file of attachments) {
    const filename = sanitizeFilename(file.name);
    lines.push(
      `--${boundary}`,
      `Content-Type: ${file.mimeType}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      wrapBase64(file.contentBase64)
    );
  }

  lines.push(`--${boundary}--`, "");
  return lines.join("\r\n");
}
