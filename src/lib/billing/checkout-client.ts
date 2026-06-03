/** Trygg parsing av checkout-API (Safari gir ofte «did not match pattern» ved ugyldig JSON) */
export async function parseCheckoutResponse(res: Response): Promise<{
  url?: string;
  fake?: boolean;
  error?: string;
}> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Tomt svar fra server"
        : `Serverfeil (${res.status}). Prøv igjen.`
    );
  }

  try {
    return JSON.parse(text) as { url?: string; fake?: boolean; error?: string };
  } catch {
    throw new Error(
      res.ok
        ? "Ugyldig svar fra server. Prøv igjen."
        : `Kunne ikke starte betaling (${res.status}).`
    );
  }
}

export function goToCheckoutUrl(url: unknown): void {
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("Mangler betalingslenke fra Stripe.");
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("Ugyldig betalingslenke. Kontakt support.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Ugyldig betalingslenke.");
  }

  window.location.assign(parsed.href);
}
