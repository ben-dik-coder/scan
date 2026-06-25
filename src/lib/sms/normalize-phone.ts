/** Normaliser norsk mobil/fast til E.164 (+47…) for SMS-API. */
export function normalizeSmsPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) throw new Error("Telefonnummer mangler");

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 8) return `+47${digits}`;
  if (digits.length === 10 && digits.startsWith("47")) return `+${digits}`;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;

  throw new Error("Ugyldig telefonnummer");
}

export function displayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  }
  return phone.trim();
}
