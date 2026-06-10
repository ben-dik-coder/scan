import { timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/auth";

export function isAgentServiceApiKeyConfigured(): boolean {
  return Boolean(process.env.AGENT_SERVICE_API_KEY?.trim());
}

export function extractAgentServiceApiKey(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const headerKey = request.headers.get("x-agent-api-key")?.trim();
  return headerKey || null;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function isValidAgentServiceApiKey(provided: string | null): boolean {
  const configured = process.env.AGENT_SERVICE_API_KEY?.trim();
  if (!configured || !provided) return false;
  return safeEqual(provided, configured);
}

export type AgentRequestAuth =
  | {
      user: User | null;
      isServiceAuth: false;
      errorResponse?: never;
    }
  | {
      user: User;
      isServiceAuth: true;
      errorResponse?: never;
    }
  | {
      user?: never;
      isServiceAuth?: never;
      errorResponse: Response;
    };

export async function resolveAgentRequestAuth(
  request: Request
): Promise<AgentRequestAuth> {
  const providedKey = extractAgentServiceApiKey(request);

  if (providedKey) {
    if (!isAgentServiceApiKeyConfigured()) {
      return {
        errorResponse: new Response(
          JSON.stringify({ error: "Agent API-nøkkel er ikke aktivert." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        ),
      };
    }

    if (!isValidAgentServiceApiKey(providedKey)) {
      return {
        errorResponse: new Response(
          JSON.stringify({ error: "Ugyldig agent API-nøkkel." }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ),
      };
    }

    const userId = process.env.AGENT_SERVICE_USER_ID?.trim();
    if (!userId) {
      return {
        errorResponse: new Response(
          JSON.stringify({
            error: "AGENT_SERVICE_USER_ID mangler på serveren.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        ),
      };
    }

    return {
      user: { id: userId } as User,
      isServiceAuth: true,
    };
  }

  const user = await getSessionUser();
  return { user, isServiceAuth: false };
}

export function shouldPersistAgentData(
  user: User | null,
  isServiceAuth: boolean
): user is User {
  if (!user) return false;
  if (isServiceAuth) return true;
  return process.env.NEXT_PUBLIC_DEMO_MODE !== "true";
}
