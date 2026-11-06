import { createServiceClient } from "@/lib/supabase/service";

export const CALLED_LIST_PREFIX = "Ringt — ";

type ListRow = {
  id: string;
  name: string;
  list_kind: string | null;
  filters: Record<string, unknown> | null;
};

function orgnrsOf(filters: Record<string, unknown> | null | undefined): string[] {
  const raw = filters?.agentOrgnrs;
  if (!Array.isArray(raw)) return [];
  return raw.filter((o): o is string => typeof o === "string" && o.trim() !== "");
}

/**
 * Når et firma er ringt: ta det ut av ringelisten og legg det i en egen
 * liste «Ringt — <listenavn>». Da ringer man aldri samme firma to ganger.
 * Feiler stille (skal aldri stoppe selve samtalen).
 */
export async function moveToCalledList(
  userId: string,
  sourceListId: string,
  orgnr: string
): Promise<{ moved: boolean; targetListId?: string }> {
  try {
    const service = createServiceClient();

    const { data: src } = await service
      .from("saved_lists")
      .select("id, name, list_kind, filters")
      .eq("id", sourceListId)
      .eq("user_id", userId)
      .maybeSingle();
    const source = src as ListRow | null;
    if (!source) return { moved: false };
    if (source.list_kind && source.list_kind !== "static") return { moved: false };
    if (source.name.startsWith(CALLED_LIST_PREFIX)) return { moved: false };

    const sourceOrgnrs = orgnrsOf(source.filters);
    if (!sourceOrgnrs.includes(orgnr)) return { moved: false };

    // Finn eller lag «Ringt»-listen
    const targetName = `${CALLED_LIST_PREFIX}${source.name}`;
    const { data: existing } = await service
      .from("saved_lists")
      .select("id, name, list_kind, filters")
      .eq("user_id", userId)
      .eq("name", targetName)
      .limit(1);
    const target = (existing?.[0] as ListRow | undefined) ?? null;

    let targetId: string;
    if (target) {
      targetId = target.id;
      const current = orgnrsOf(target.filters);
      const next = [orgnr, ...current.filter((o) => o !== orgnr)];
      const { error } = await service
        .from("saved_lists")
        .update({
          filters: { ...(target.filters ?? {}), agentOrgnrs: next },
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id);
      if (error) return { moved: false };
    } else {
      const { data: created, error } = await service
        .from("saved_lists")
        .insert({
          user_id: userId,
          name: targetName,
          filters: {
            days: 0,
            createdBy: "user",
            websitePresence: "all",
            agentOrgnrs: [orgnr],
          },
        })
        .select("id")
        .single();
      if (error || !created) return { moved: false };
      targetId = (created as { id: string }).id;
    }

    // Først nå fjernes firmaet fra kildelisten (aldri tapt hvis noe feiler)
    const { error: removeError } = await service
      .from("saved_lists")
      .update({
        filters: {
          ...(source.filters ?? {}),
          agentOrgnrs: sourceOrgnrs.filter((o) => o !== orgnr),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", source.id);
    if (removeError) return { moved: false, targetListId: targetId };

    return { moved: true, targetListId: targetId };
  } catch (err) {
    console.error("moveToCalledList failed", err);
    return { moved: false };
  }
}
