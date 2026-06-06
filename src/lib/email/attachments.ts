export type EmailAttachment = {
  name: string;
  mimeType: string;
  contentBase64: string;
};

export const MAX_ATTACHMENT_FILES = 10;
export const MAX_ATTACHMENT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_TOTAL_BYTES = 4 * 1024 * 1024;

export function attachmentBytes(attachment: EmailAttachment): number {
  return Math.floor((attachment.contentBase64.length * 3) / 4);
}

export function totalAttachmentBytes(attachments: EmailAttachment[]): number {
  return attachments.reduce((sum, file) => sum + attachmentBytes(file), 0);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateAttachments(attachments: EmailAttachment[]): string | null {
  if (attachments.length > MAX_ATTACHMENT_FILES) {
    return `Maks ${MAX_ATTACHMENT_FILES} filer per e-post.`;
  }

  for (const file of attachments) {
    const bytes = attachmentBytes(file);
    if (bytes > MAX_ATTACHMENT_FILE_BYTES) {
      return `"${file.name}" er for stor (maks ${formatFileSize(MAX_ATTACHMENT_FILE_BYTES)} per fil).`;
    }
  }

  const total = totalAttachmentBytes(attachments);
  if (total > MAX_ATTACHMENT_TOTAL_BYTES) {
    return `Vedleggene er for store totalt (maks ${formatFileSize(MAX_ATTACHMENT_TOTAL_BYTES)}).`;
  }

  return null;
}

export function parseAttachmentsFromBody(
  raw: unknown
): EmailAttachment[] | null {
  if (!Array.isArray(raw)) return null;

  const parsed: EmailAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const mimeType =
      typeof item.mimeType === "string" ? item.mimeType.trim() : "";
    const contentBase64 =
      typeof item.contentBase64 === "string" ? item.contentBase64.trim() : "";
    if (!name || !mimeType || !contentBase64) return null;
    parsed.push({ name, mimeType, contentBase64 });
  }

  return parsed;
}
