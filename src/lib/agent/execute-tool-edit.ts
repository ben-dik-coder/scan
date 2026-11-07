import {
  agentOrgnrsFromFilters,
  mergeOrgnrsIntoFilters,
} from "@/lib/agent/saved-list-filters";
import {
  createDeleteConfirmToken,
  verifyDeleteConfirm,
} from "@/lib/agent/delete-confirm";
import type {
  AgentToolContext,
  ToolExecutionResult,
} from "@/lib/agent/execute-tool";
import {
  aiCallConfigErrorMessage,
  isAiCallConfigured,
} from "@/lib/ai-call/config";
import {
  humanizeAiCallStartError,
  looksLikeDialFailure,
} from "@/lib/ai-call/credits";
import { hangUpElevenLabsConversation } from "@/lib/ai-call/hangup";
import { moveToCalledList } from "@/lib/ai-call/move-to-called-list";
import { resolveAiCallTarget } from "@/lib/ai-call/resolve-phone";
import { startAiOutboundCall } from "@/lib/ai-call/start-call";
import { getEntitlements, requireFeature } from "@/lib/billing/entitlements";
import { persistCompanyPhonePatch } from "@/lib/company-contact-overrides";
import { isDemoMode } from "@/lib/demo/config";
import {
  deleteUserLead,
  logActivity,
  upsertUserLead,
} from "@/lib/sales/activities";
import { pauseEnrollmentsOnReply } from "@/lib/sales/sequences";
import { sendSmsMessage } from "@/lib/sms/send-sms";
import {
  addOrgnrsToSmartList,
  createSmartList,
  deleteSmartList,
  listSmartLists,
  loadSmartListBoard,
  patchSmartListItems,
  removeSmartListItems,
  updateSmartListMeta,
} from "@/lib/smartliste/smart-list-service";
import type {
  SmartListBoardConfig,
  SmartListItemPatch,
  SmartListKind,
} from "@/lib/smartliste/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyLeadQueued } from "@/lib/webhooks/dispatch";
import { searchSerper } from "@/lib/website-scan/serper";
import {
  isValidNorwegianPhoneCore,
  phoneCoreDigits,
} from "@/lib/website-scan/phone-plausible";
import { resolveCompanyPhone } from "@/lib/website-scan/resolve-company-contact";
import { loadCachedWebsiteScans } from "@/lib/website-scan/saved-scans-server";
import type { AiCall, Company } from "@/types/database";

const LEAD_STATUSES = new Set([
  "ny",
  "kontaktet",
  "svarte",
  "moete_booket",
  "vunnet",
  "tapt",
  "ikke_interessert",
]);

function stringArg(args: Record<string, unknown>, key: string): string {
  return typeof args[key] === "string" ? args[key].trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function objectArg(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function failure(summary: string, error: unknown): ToolExecutionResult {
  const message = error instanceof Error ? error.message : String(error);
  return { summary: `${summary}: ${message}`, data: { error: message } };
}

function missing(field: string): ToolExecutionResult {
  return {
    summary: `Mangler ${field}`,
    data: { error: "missing_field", field },
  };
}

function confirmRequired(
  ctx: AgentToolContext,
  resourceId: string,
  resourceType: string,
  resourceName?: string
): ToolExecutionResult {
  const confirmToken = createDeleteConfirmToken(
    ctx.userId,
    resourceType,
    resourceId,
    resourceName
  );
  return {
    summary: `Er du sikker på at du vil slette ${
      resourceName ? `«${resourceName}»` : resourceId
    }?`,
    data: {
      error: "confirm_required",
      needsConfirm: true,
      confirmToken,
      resourceId,
      ...(resourceType === "lead" ? { orgnr: resourceId } : { listId: resourceId }),
      resourceType,
      resourceName,
    },
  };
}

async function requireOwnedSmartList(
  userId: string,
  listId: string
): Promise<void> {
  await loadSmartListBoard(userId, listId);
}

export async function update_saved_list(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const listId = stringArg(args, "listId");
  if (!listId) return missing("listId");

  try {
    const supabase = await createClient();
    const { data: current, error: fetchError } = await supabase
      .from("saved_lists")
      .select("id, name, filters")
      .eq("id", listId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!current) {
      return { summary: "Listen finnes ikke", data: { error: "not_found", listId } };
    }

    const filters = {
      ...((current.filters as Record<string, unknown> | null) ?? {}),
    };
    const addOrgnrs = stringArray(args.addOrgnrs);
    const removeOrgnrs = new Set(stringArray(args.removeOrgnrs));

    if (addOrgnrs.length > 0) {
      Object.assign(filters, mergeOrgnrsIntoFilters(filters, addOrgnrs, "user"));
    }
    if (removeOrgnrs.size > 0) {
      filters.agentOrgnrs = agentOrgnrsFromFilters(filters).filter(
        (orgnr) => !removeOrgnrs.has(orgnr)
      );
    }
    if (typeof args.group === "string") {
      const group = args.group.trim();
      if (group) filters.group = group;
      else delete filters.group;
    }

    const updates: Record<string, unknown> = { filters };
    const name = stringArg(args, "name");
    if (name) updates.name = name;

    const { data, error } = await supabase
      .from("saved_lists")
      .update(updates)
      .eq("id", listId)
      .eq("user_id", ctx.userId)
      .select("id, name, filters")
      .single();

    if (error) throw new Error(error.message);
    const orgnrCount = agentOrgnrsFromFilters(
      data.filters as Record<string, unknown>
    ).length;
    return {
      summary: `Oppdaterte listen «${data.name}» (${orgnrCount} firma)`,
      data: { list: data, orgnrCount },
    };
  } catch (error) {
    return failure("Kunne ikke oppdatere listen", error);
  }
}

export async function delete_saved_list(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const listId = stringArg(args, "listId");
  if (!listId) return missing("listId");
  const confirmToken = stringArg(args, "confirmToken");
  if (
    !confirmToken ||
    !verifyDeleteConfirm(ctx.userId, "saved_list", listId, confirmToken)
  ) {
    return confirmRequired(ctx, listId, "saved_list");
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("saved_lists")
      .delete()
      .eq("id", listId)
      .eq("user_id", ctx.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return { summary: "Listen finnes ikke", data: { error: "not_found", listId } };
    }
    return { summary: "Listen er slettet", data: { ok: true, listId } };
  } catch (error) {
    return failure("Kunne ikke slette listen", error);
  }
}

export async function list_smartlists(
  ctx: AgentToolContext,
  _args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  void _args;
  try {
    const lists = await listSmartLists(ctx.userId);
    return {
      summary: `Fant ${lists.length} smartlister`,
      data: { lists },
    };
  } catch (error) {
    return failure("Kunne ikke hente smartlister", error);
  }
}

export async function create_smartlist(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const name = stringArg(args, "name");
  if (!name) return missing("name");

  const rawKind = args.listKind ?? args.list_kind;
  const listKind: SmartListKind = rawKind === "dynamic" ? "dynamic" : "static";
  const filters = objectArg(args.filters) ?? {};
  const boardConfig = objectArg(
    args.boardConfig ?? args.board_config
  ) as SmartListBoardConfig | undefined;

  try {
    const list = await createSmartList(ctx.userId, name, {
      listKind,
      filters,
      boardConfig,
    });
    return {
      summary: `Opprettet smartlisten «${list.name}»`,
      data: { list },
    };
  } catch (error) {
    return failure("Kunne ikke opprette smartlisten", error);
  }
}

export async function update_smartlist(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const listId = stringArg(args, "listId");
  if (!listId) return missing("listId");

  const name = stringArg(args, "name") || undefined;
  const boardConfig = objectArg(
    args.boardConfig ?? args.board_config
  ) as SmartListBoardConfig | undefined;
  const rawKind = args.listKind ?? args.list_kind;
  const listKind: SmartListKind | undefined =
    rawKind === "static" || rawKind === "dynamic" ? rawKind : undefined;

  if (!name && !boardConfig && !listKind) {
    return {
      summary: "Ingen endringer å lagre",
      data: { error: "no_changes", listId },
    };
  }

  try {
    await requireOwnedSmartList(ctx.userId, listId);
    await updateSmartListMeta(ctx.userId, listId, {
      name,
      board_config: boardConfig,
      list_kind: listKind,
    });
    const board = await loadSmartListBoard(ctx.userId, listId);
    return {
      summary: `Oppdaterte smartlisten «${board.list.name}»`,
      data: { board },
    };
  } catch (error) {
    return failure("Kunne ikke oppdatere smartlisten", error);
  }
}

export async function delete_smartlist(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const listId = stringArg(args, "listId");
  if (!listId) return missing("listId");
  const confirmToken = stringArg(args, "confirmToken");
  if (
    !confirmToken ||
    !verifyDeleteConfirm(ctx.userId, "smartliste", listId, confirmToken)
  ) {
    return confirmRequired(ctx, listId, "smartliste");
  }

  try {
    await requireOwnedSmartList(ctx.userId, listId);
    await deleteSmartList(ctx.userId, listId);
    return {
      summary: "Smartlisten er slettet",
      data: { ok: true, listId },
    };
  } catch (error) {
    return failure("Kunne ikke slette smartlisten", error);
  }
}

export async function smartlist_add_items(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const listId = stringArg(args, "listId");
  if (!listId) return missing("listId");
  const orgnrs = stringArray(args.orgnrs);
  if (orgnrs.length === 0) return missing("orgnrs");

  try {
    await requireOwnedSmartList(ctx.userId, listId);
    const added = await addOrgnrsToSmartList(ctx.userId, listId, orgnrs);
    return {
      summary: `La til ${added} firma i smartlisten`,
      data: { ok: true, listId, added },
    };
  } catch (error) {
    return failure("Kunne ikke legge til firma", error);
  }
}

export async function smartlist_update_items(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const listId = stringArg(args, "listId");
  if (!listId) return missing("listId");
  const patches = Array.isArray(args.patches)
    ? (args.patches.filter(
        (patch) =>
          patch &&
          typeof patch === "object" &&
          !Array.isArray(patch) &&
          typeof (patch as { id?: unknown }).id === "string"
      ) as SmartListItemPatch[])
    : [];
  if (patches.length === 0) return missing("patches");

  try {
    await requireOwnedSmartList(ctx.userId, listId);
    await patchSmartListItems(ctx.userId, listId, patches);
    return {
      summary: `Oppdaterte ${patches.length} kort i smartlisten`,
      data: { ok: true, listId, updated: patches.length },
    };
  } catch (error) {
    return failure("Kunne ikke oppdatere kortene", error);
  }
}

export async function smartlist_remove_items(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const listId = stringArg(args, "listId");
  if (!listId) return missing("listId");
  const itemIds = stringArray(args.itemIds);
  if (itemIds.length === 0) return missing("itemIds");

  try {
    await requireOwnedSmartList(ctx.userId, listId);
    await removeSmartListItems(ctx.userId, listId, itemIds);
    return {
      summary: `Fjernet ${itemIds.length} kort fra smartlisten`,
      data: { ok: true, listId, removed: itemIds.length },
    };
  } catch (error) {
    return failure("Kunne ikke fjerne kortene", error);
  }
}

export async function set_lead_status(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const orgnr = stringArg(args, "orgnr");
  const status = stringArg(args, "status");
  if (!orgnr) return missing("orgnr");
  if (!status) return missing("status");
  if (!LEAD_STATUSES.has(status)) {
    return { summary: "Ugyldig lead-status", data: { error: "invalid_status" } };
  }

  const queue = args.queue === true;
  const unqueue = args.unqueue === true;
  const updates: {
    status: string;
    last_contacted_at?: string;
    queued_at?: string | null;
  } = { status };

  if (status === "kontaktet") updates.last_contacted_at = new Date().toISOString();
  if (queue && status === "ny") updates.queued_at = new Date().toISOString();
  if (unqueue || status === "ikke_interessert") updates.queued_at = null;

  try {
    let shouldNotifyQueue = false;
    if (queue && status === "ny") {
      const supabase = createServiceClient();
      const { data: existing } = await supabase
        .from("user_leads")
        .select("queued_at")
        .eq("user_id", ctx.userId)
        .eq("orgnr", orgnr)
        .maybeSingle();
      shouldNotifyQueue = !existing?.queued_at;
    }

    await upsertUserLead(ctx.userId, orgnr, updates);
    if (shouldNotifyQueue) {
      void notifyLeadQueued(ctx.userId, orgnr).catch((error) => {
        console.warn("[agent] lead.queued webhook feilet:", error);
      });
    }

    return {
      summary: `Lead-status er satt til ${status}`,
      data: { ok: true, orgnr, status, queued: updates.queued_at ?? undefined },
    };
  } catch (error) {
    return failure("Kunne ikke endre lead-status", error);
  }
}

export async function update_lead(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const orgnr = stringArg(args, "orgnr");
  if (!orgnr) return missing("orgnr");

  const status = typeof args.status === "string" ? args.status.trim() : undefined;
  if (status && !LEAD_STATUSES.has(status)) {
    return { summary: "Ugyldig lead-status", data: { error: "invalid_status" } };
  }

  const updates: {
    status?: string;
    notes?: string;
    next_follow_up_at?: string | null;
  } = {};
  if (typeof args.notes === "string") updates.notes = args.notes;
  if (status) updates.status = status;
  if (args.followUpAt === null) updates.next_follow_up_at = null;
  else if (typeof args.followUpAt === "string") {
    updates.next_follow_up_at = args.followUpAt.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return { summary: "Ingen endringer å lagre", data: { error: "no_changes" } };
  }

  try {
    const entitlements = await getEntitlements(ctx.userId);
    const featureError = requireFeature(entitlements, "pipeline");
    if (featureError) {
      return { summary: featureError, data: { error: "feature_required" } };
    }

    await upsertUserLead(ctx.userId, orgnr, updates);
    if (status === "svarte") {
      await pauseEnrollmentsOnReply(ctx.userId, orgnr);
    }
    return { summary: "Lead er oppdatert", data: { ok: true, orgnr, updates } };
  } catch (error) {
    return failure("Kunne ikke oppdatere lead", error);
  }
}

export async function delete_lead(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const orgnr = stringArg(args, "orgnr");
  if (!orgnr) return missing("orgnr");
  const confirmToken = stringArg(args, "confirmToken");
  if (
    !confirmToken ||
    !verifyDeleteConfirm(ctx.userId, "lead", orgnr, confirmToken)
  ) {
    return confirmRequired(ctx, orgnr, "lead");
  }

  try {
    await deleteUserLead(ctx.userId, orgnr);
    return { summary: "Lead er slettet", data: { ok: true, orgnr } };
  } catch (error) {
    return failure("Kunne ikke slette lead", error);
  }
}

export async function set_company_phone(
  _ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const orgnr = stringArg(args, "orgnr");
  const rawPhone = stringArg(args, "phone");
  if (!orgnr) return missing("orgnr");
  if (!rawPhone) return missing("phone");

  const core = phoneCoreDigits(rawPhone);
  if (!core || !isValidNorwegianPhoneCore(core)) {
    return {
      summary: "Ugyldig norsk telefonnummer (8 siffer)",
      data: { error: "invalid_phone" },
    };
  }
  const patch = core.startsWith("9") || core.startsWith("4")
    ? { mobile: core }
    : { phone: core };

  try {
    await persistCompanyPhonePatch(orgnr, patch);
    return {
      summary: `Telefonnummeret er lagret: ${core}`,
      data: { ok: true, orgnr, phone: core, ...patch },
    };
  } catch (error) {
    return failure("Kunne ikke lagre telefonnummeret", error);
  }
}

export async function start_ai_call(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const orgnr = stringArg(args, "orgnr");
  const listId = stringArg(args, "listId");
  if (!orgnr) return missing("orgnr");
  if (isDemoMode()) {
    return {
      summary: "AI-ring er ikke tilgjengelig i demo-modus",
      data: { error: "demo_mode" },
    };
  }
  if (!isAiCallConfigured()) {
    return {
      summary: aiCallConfigErrorMessage(),
      data: { error: "not_configured" },
    };
  }

  const service = createServiceClient();
  try {
    const { data: activeRows, error: activeError } = await service
      .from("ai_calls")
      .select("id, status, orgnr")
      .eq("user_id", ctx.userId)
      .in("status", ["queued", "ringing", "in_progress"])
      .limit(1);
    if (activeError) throw new Error(activeError.message);
    if (activeRows?.length) {
      return {
        summary: "Du har allerede et aktivt AI-kall. Vent til det er ferdig.",
        data: { error: "active_call", activeCallId: activeRows[0]!.id },
      };
    }

    const supabase = await createClient();
    const { data: companyRow, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("orgnr", orgnr)
      .maybeSingle();
    if (companyError) throw new Error(companyError.message);
    if (!companyRow) {
      return { summary: "Firma ikke funnet", data: { error: "not_found", orgnr } };
    }

    const company = companyRow as Company;
    const target = await resolveAiCallTarget(company);
    if (target.skippedReason || !target.phoneE164) {
      return {
        summary: target.skippedReason ?? "Fant ikke telefonnummer",
        data: { error: "no_call_target", orgnr },
      };
    }

    const phonePatch: Partial<Company> = {};
    if ((target.company.mobile ?? "") !== (company.mobile ?? "")) {
      phonePatch.mobile = target.company.mobile;
    }
    if ((target.company.phone ?? "") !== (company.phone ?? "")) {
      phonePatch.phone = target.company.phone;
    }
    if ((target.company.daglig_leder ?? "") !== (company.daglig_leder ?? "")) {
      phonePatch.daglig_leder = target.company.daglig_leder;
    }
    if (Object.keys(phonePatch).length > 0) {
      await service.from("companies").update(phonePatch).eq("orgnr", orgnr);
    }

    const { data: inserted, error: insertError } = await service
      .from("ai_calls")
      .insert({
        user_id: ctx.userId,
        orgnr,
        phone: target.phoneE164,
        status: "queued",
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "Kunne ikke opprette AI-kall");
    }

    try {
      const started = await startAiOutboundCall({
        customerNumberE164: target.phoneE164,
        promptVars: {
          companyName: target.company.name,
          contactName: target.contactName,
          municipality: target.company.municipality_name,
          phone: target.phoneE164,
          email: target.company.email,
          hasWebsite: Boolean((target.company.website ?? "").trim()),
          sellerCompanyName: "North Digital",
          industryCode: target.company.industry_code,
        },
        metadata: {
          aiCallId: inserted.id as string,
          userId: ctx.userId,
          orgnr,
        },
      });

      const { data: updated, error: updateError } = await service
        .from("ai_calls")
        .update({
          vapi_call_id: started.externalCallId,
          status: "ringing",
          raw_payload: started.raw,
        })
        .eq("id", inserted.id)
        .select("*")
        .single();
      if (updateError) throw new Error(updateError.message);

      await upsertUserLead(ctx.userId, orgnr, {
        status: "kontaktet",
        last_contacted_at: new Date().toISOString(),
      });
      await logActivity(ctx.userId, orgnr, "call", "AI-ring startet", {
        ai_call_id: inserted.id,
        provider: started.provider,
        external_call_id: started.externalCallId,
        vapi_call_id: started.externalCallId,
        phone: target.phoneE164,
      });

      const movedToCalled = listId
        ? (await moveToCalledList(ctx.userId, listId, orgnr)).moved
        : false;
      return {
        summary: `AI-ring er startet til ${target.company.name}`,
        data: {
          ok: true,
          movedToCalled,
          provider: started.provider,
          call: updated,
          phone: target.phoneE164,
          contactName: target.contactName,
        },
      };
    } catch (error) {
      const message = humanizeAiCallStartError(error);
      const dialFailed = looksLikeDialFailure(message);
      const { data: failedRow } = await service
        .from("ai_calls")
        .update({
          status: "failed",
          outcome: dialFailed ? "no_answer" : "other",
          ended_at: new Date().toISOString(),
          summary: message,
        })
        .eq("id", inserted.id)
        .select("*")
        .single();

      if (dialFailed && failedRow) {
        await upsertUserLead(ctx.userId, orgnr, {
          status: "kontaktet",
          last_contacted_at: new Date().toISOString(),
        });
        await logActivity(
          ctx.userId,
          orgnr,
          "call",
          `AI-ring uten kontakt: ${message}`,
          { ai_call_id: inserted.id, phone: target.phoneE164 }
        );
        const movedToCalled = listId
          ? (await moveToCalledList(ctx.userId, listId, orgnr)).moved
          : false;
        return {
          summary: `AI-ring fikk ikke kontakt: ${message}`,
          data: {
            ok: true,
            dialFailed: true,
            movedToCalled,
            call: failedRow,
            phone: target.phoneE164,
          },
        };
      }

      return {
        summary: `Kunne ikke starte AI-ring: ${message}`,
        data: { error: message, callId: inserted.id },
      };
    }
  } catch (error) {
    return failure("Kunne ikke starte AI-ring", error);
  }
}

export async function hangup_ai_call(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const callId = stringArg(args, "callId");
  const service = createServiceClient();

  try {
    let query = service
      .from("ai_calls")
      .select("*")
      .eq("user_id", ctx.userId);
    query = callId
      ? query.eq("id", callId)
      : query
          .in("status", ["queued", "ringing", "in_progress"])
          .order("started_at", { ascending: false })
          .limit(1);

    const { data: row, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      return {
        summary: callId ? "Fant ikke AI-kallet" : "Du har ingen aktive AI-kall",
        data: { error: "not_found", callId: callId || null },
      };
    }

    const call = row as AiCall;
    const active = ["queued", "ringing", "in_progress"].includes(call.status);
    if (!active) {
      return {
        summary: "AI-kallet er allerede avsluttet",
        data: { ok: true, alreadyEnded: true, call },
      };
    }

    const conversationId =
      typeof call.vapi_call_id === "string" ? call.vapi_call_id : "";
    if (!conversationId) {
      return {
        summary: "Fant ingen aktiv ElevenLabs-samtale å legge på",
        data: { error: "missing_conversation_id", callId: call.id },
      };
    }

    await hangUpElevenLabsConversation(conversationId);
    const { data: updated, error: updateError } = await service
      .from("ai_calls")
      .update({
        status: "ended",
        outcome: "other",
        ended_at: new Date().toISOString(),
        summary: "Manuelt lagt på",
      })
      .eq("id", call.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);

    return {
      summary: "AI-kallet er lagt på",
      data: { ok: true, call: updated, hungUpVia: "elevenlabs-sip" },
    };
  } catch (error) {
    return failure("Kunne ikke legge på AI-kallet", error);
  }
}

export async function send_sms(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const orgnr = stringArg(args, "orgnr");
  const message = stringArg(args, "message");
  if (!orgnr) return missing("orgnr");
  if (!message) return missing("message");

  try {
    const supabase = await createClient();
    const { data: companyRow, error } = await supabase
      .from("companies")
      .select("*")
      .eq("orgnr", orgnr)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!companyRow) {
      return { summary: "Firma ikke funnet", data: { error: "not_found", orgnr } };
    }

    const [scan] = await loadCachedWebsiteScans([orgnr]);
    const target = resolveCompanyPhone(companyRow as Company, scan);
    if (!target) {
      return {
        summary: "Fant ikke gyldig telefonnummer til firmaet",
        data: { error: "no_phone", orgnr },
      };
    }

    const result = isDemoMode()
      ? { id: `demo-${Date.now()}` }
      : await sendSmsMessage(target.phone, message);
    await upsertUserLead(ctx.userId, orgnr, {
      status: "kontaktet",
      last_contacted_at: new Date().toISOString(),
    });
    return {
      summary: isDemoMode() ? "SMS simulert i demo-modus" : "SMS er sendt",
      data: { ok: true, id: result.id, orgnr, phone: target.phone },
    };
  } catch (error) {
    return failure("Kunne ikke sende SMS", error);
  }
}

export async function get_settings(
  ctx: AgentToolContext,
  _args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  void _args;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const settings = {
      webhookUrl: data?.webhook_url ?? "",
      weeklyAlertEnabled: data?.weekly_alert_enabled ?? false,
      weeklyAlertFilters: data?.weekly_alert_filters ?? {},
      weeklyAlertLastSentAt: data?.weekly_alert_last_sent_at ?? null,
    };
    return { summary: "Hentet innstillingene", data: settings };
  } catch (error) {
    return failure("Kunne ikke hente innstillingene", error);
  }
}

export async function update_settings(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const webhookUrl =
    typeof args.webhookUrl === "string" ? args.webhookUrl.trim() : undefined;
  const weeklyAlertEnabled =
    typeof args.weeklyAlertEnabled === "boolean"
      ? args.weeklyAlertEnabled
      : undefined;
  const weeklyAlertFilters = objectArg(args.weeklyAlertFilters);

  if (webhookUrl && !/^https?:\/\/.+/i.test(webhookUrl)) {
    return {
      summary: "Webhook-URL må starte med http:// eller https://",
      data: { error: "invalid_webhook_url" },
    };
  }
  if (
    webhookUrl === undefined &&
    weeklyAlertEnabled === undefined &&
    weeklyAlertFilters === undefined
  ) {
    return { summary: "Ingen endringer å lagre", data: { error: "no_changes" } };
  }

  try {
    const patch: Record<string, unknown> = { user_id: ctx.userId };
    if (webhookUrl !== undefined) patch.webhook_url = webhookUrl || null;
    if (weeklyAlertEnabled !== undefined) {
      patch.weekly_alert_enabled = weeklyAlertEnabled;
    }
    if (weeklyAlertFilters !== undefined) {
      patch.weekly_alert_filters = weeklyAlertFilters;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_settings")
      .upsert(patch, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return {
      summary: "Innstillingene er oppdatert",
      data: {
        webhookUrl: data.webhook_url ?? "",
        weeklyAlertEnabled: data.weekly_alert_enabled,
        weeklyAlertFilters: data.weekly_alert_filters,
      },
    };
  } catch (error) {
    return failure("Kunne ikke oppdatere innstillingene", error);
  }
}

export async function web_search(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const query = stringArg(args, "query");
  if (!query) return missing("query");
  const requested =
    typeof args.num === "number" && Number.isFinite(args.num)
      ? Math.floor(args.num)
      : 10;
  const num = Math.min(20, Math.max(1, requested));

  try {
    const hits = (await searchSerper(query, {
      num,
      userId: ctx.userId,
    })).slice(0, num);
    return {
      summary: `Fant ${hits.length} søkeresultater for «${query}»`,
      data: {
        query,
        results: hits.map((hit) => ({
          title: hit.title,
          snippet: hit.snippet ?? "",
          link: hit.link,
        })),
      },
    };
  } catch (error) {
    return failure("Nettsøket feilet", error);
  }
}

export async function request_delete_confirm(
  ctx: AgentToolContext,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const resourceType = stringArg(args, "resourceType");
  const resourceId = stringArg(args, "resourceId");
  const resourceName = stringArg(args, "resourceName") || undefined;
  if (!resourceType) return missing("resourceType");
  if (!resourceId) return missing("resourceId");

  const confirmToken = createDeleteConfirmToken(
    ctx.userId,
    resourceType,
    resourceId,
    resourceName
  );
  return {
    summary: `Bekreft at du vil slette ${resourceName ? `«${resourceName}»` : resourceId}`,
    data: {
      needsConfirm: true,
      confirmToken,
      confirmHint: "Bruk confirmToken i neste slettekall innen 10 minutter.",
      resourceType,
      resourceId,
      resourceName,
    },
  };
}
