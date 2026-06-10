import { NextResponse } from "next/server";
import { AGENT_DISABLED_MESSAGE, isAgentEnabled } from "@/lib/agent/constants";
import {
  cancelScheduledMessage,
  createScheduledMessage,
  listUserScheduledMessages,
} from "@/lib/agent/scheduled-messages";
import {
  resolveAgentRequestAuth,
  shouldPersistAgentData,
} from "@/lib/agent/service-auth";
import { getEntitlements } from "@/lib/billing/entitlements";
import { isDemoMode } from "@/lib/demo/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAgentEnabled()) {
    return NextResponse.json({ error: AGENT_DISABLED_MESSAGE }, { status: 503 });
  }

  const auth = await resolveAgentRequestAuth(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const { user } = auth;
  if (!user) {
    return NextResponse.json({ error: "Du må være innlogget." }, { status: 401 });
  }

  try {
    const scheduled = await listUserScheduledMessages(user.id);
    return NextResponse.json({ scheduled });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke hente planlagte meldinger";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAgentEnabled()) {
    return NextResponse.json({ error: AGENT_DISABLED_MESSAGE }, { status: 503 });
  }

  const auth = await resolveAgentRequestAuth(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const { user, isServiceAuth } = auth;
  const persist = shouldPersistAgentData(user, isServiceAuth);

  if (!user && !isDemoMode()) {
    return NextResponse.json({ error: "Du må være innlogget." }, { status: 401 });
  }

  if (!persist) {
    return NextResponse.json(
      { error: "Planlagte meldinger krever innlogging (ikke demo-modus)." },
      { status: 403 }
    );
  }

  if (!isServiceAuth) {
    const entitlements = await getEntitlements(user.id);
    if (!entitlements.hasAccess) {
      return NextResponse.json(
        { error: "Aktivt abonnement kreves." },
        { status: 403 }
      );
    }
  }

  let body: { message?: string; scheduledAt?: string; conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Melding mangler" }, { status: 400 });
  }

  const scheduledAt = body.scheduledAt?.trim();
  if (!scheduledAt) {
    return NextResponse.json({ error: "Tidspunkt mangler" }, { status: 400 });
  }

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    return NextResponse.json({ error: "Ugyldig tidspunkt" }, { status: 400 });
  }

  if (scheduledDate.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Tidspunktet må være i fremtiden." },
      { status: 400 }
    );
  }

  try {
    const scheduled = await createScheduledMessage(
      user.id,
      message,
      scheduledDate.toISOString(),
      body.conversationId ?? null
    );
    return NextResponse.json(scheduled);
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "Kunne ikke planlegge melding";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isAgentEnabled()) {
    return NextResponse.json({ error: AGENT_DISABLED_MESSAGE }, { status: 503 });
  }

  const auth = await resolveAgentRequestAuth(request);
  if ("errorResponse" in auth) {
    return auth.errorResponse;
  }

  const { user } = auth;
  if (!user) {
    return NextResponse.json({ error: "Du må være innlogget." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID mangler" }, { status: 400 });
  }

  try {
    const cancelled = await cancelScheduledMessage(user.id, id);
    if (!cancelled) {
      return NextResponse.json(
        { error: "Fant ikke planlagt melding, eller den kan ikke avbrytes." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kunne ikke avbryte";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
