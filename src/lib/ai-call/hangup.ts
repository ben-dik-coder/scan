/**
 * Avslutt aktiv AI-outbound via ElevenLabs (ice SIP).
 * Ingen Twilio — vi ringer bare gjennom SIP-trunk.
 */

import WebSocket from "ws";

/**
 * Stopp aktiv ElevenLabs SIP-samtale.
 * Monitor WebSocket end_call kutter linjen midt i samtalen.
 */
export async function hangUpElevenLabsConversation(
  conversationId: string
): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ElevenLabs er ikke konfigurert");
  }
  if (!conversationId.startsWith("conv_")) {
    throw new Error("Ugyldig conversation-id");
  }

  const viaMonitor = await endCallViaMonitorSocket(conversationId, apiKey);

  // Rydd samtale-record (best-effort)
  await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
    {
      method: "DELETE",
      headers: { "xi-api-key": apiKey },
    }
  ).catch(() => null);

  if (!viaMonitor) {
    throw new Error(
      "Klarte ikke å legge på. Prøv igjen, eller la Frida si ha det (da legger hun på selv)."
    );
  }
}

function endCallViaMonitorSocket(
  conversationId: string,
  apiKey: string
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let opened = false;

    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };

    const timer = setTimeout(() => done(opened), 3500);

    let ws: WebSocket;
    try {
      ws = new WebSocket(
        `wss://api.elevenlabs.io/v1/convai/conversations/${conversationId}/monitor`,
        {
          headers: { "xi-api-key": apiKey },
        }
      );
    } catch {
      resolve(false);
      return;
    }

    ws.on("open", () => {
      opened = true;
      try {
        ws.send(JSON.stringify({ command_type: "end_call" }));
      } catch {
        done(false);
        return;
      }
      setTimeout(() => done(true), 500);
    });

    ws.on("error", () => done(false));
    ws.on("close", () => {
      if (!settled) done(opened);
    });
  });
}
