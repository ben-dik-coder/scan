import type OpenAI from "openai";
import {
  AGENT_MAX_FAST_LIST_LIMIT,
  AGENT_MAX_SCAN_PER_CALL,
} from "@/lib/agent/constants";

type FunctionDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const EMPTY_PARAMS: Record<string, unknown> = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

const AGENT_FUNCTION_DEFS: FunctionDef[] = [
  {
    name: "get_usage",
    description:
      "Hent Serper-kvote og kontakt-kvote for brukeren denne måneden. Kjør før store scan_websites-jobber.",
    parameters: EMPTY_PARAMS,
  },
  {
    name: "get_entitlements",
    description: "Alias for get_usage — kontakt- og Serper-kvote",
    parameters: EMPTY_PARAMS,
  },
  {
    name: "list_saved_lists",
    description: "List brukerens lagrede Skann-lister (navn, filter, antall firma)",
    parameters: EMPTY_PARAMS,
  },
  {
    name: "load_saved_list",
    description: "Last orgnr fra en eksisterende lagret liste",
    parameters: {
      type: "object",
      properties: {
        listId: { type: "string", description: "ID på lagret liste" },
        name: { type: "string", description: "Navn på liste (alternativ til listId)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "remember_preference",
    description:
      "Lagre bruker-preferanse for fremtidige samtaler (default_municipality, default_region, default_industry, sales_focus, notes).",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string" },
        value: { type: "string" },
      },
      required: ["key", "value"],
      additionalProperties: false,
    },
  },
  {
    name: "search_companies",
    description:
      "Søk firma i Brreg-databasen etter kommune, region, bransje, yrke eller ord i firmanavn. Ved hurtigliste: sett limit til antall brukeren ba om.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: `Maks antall firma å returnere (1–${AGENT_MAX_FAST_LIST_LIMIT}).`,
        },
        municipalityCode: { type: "string" },
        regionId: { type: "string" },
        industryGroup: { type: "string" },
        professionId: { type: "string" },
        days: { type: "number" },
        nameQuery: { type: "string" },
        withoutWebsite: { type: "boolean" },
        excludeIndustryGroups: { type: "array", items: { type: "string" } },
        requirePhone: { type: "boolean" },
        excludeOrgnrs: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
  },
  {
    name: "scan_websites",
    description: `Skann nettside for orgnr (maks ${AGENT_MAX_SCAN_PER_CALL} per kall). Bare når brukeren ber om nettside-skann.`,
    parameters: {
      type: "object",
      properties: {
        orgnrs: { type: "array", items: { type: "string" } },
        includeFacebook: { type: "boolean" },
        includeInstagram: { type: "boolean" },
      },
      required: ["orgnrs"],
      additionalProperties: false,
    },
  },
  {
    name: "enrich_contacts",
    description: "Berik telefon og e-post for firma via Brreg og nettside-skann",
    parameters: {
      type: "object",
      properties: {
        orgnrs: { type: "array", items: { type: "string" } },
      },
      required: ["orgnrs"],
      additionalProperties: false,
    },
  },
  {
    name: "filter_no_website",
    description:
      "Filtrer orgnr til de uten egen nettside. Krever scan_websites først.",
    parameters: {
      type: "object",
      properties: {
        orgnrs: { type: "array", items: { type: "string" } },
      },
      required: ["orgnrs"],
      additionalProperties: false,
    },
  },
  {
    name: "filter_leads",
    description: "Filtrer orgnr etter skann-resultat: Facebook, telefon, confidence",
    parameters: {
      type: "object",
      properties: {
        orgnrs: { type: "array", items: { type: "string" } },
        facebookOnly: { type: "boolean" },
        hasPhone: { type: "boolean" },
        minConfidence: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["orgnrs"],
      additionalProperties: false,
    },
  },
  {
    name: "save_list",
    description: "Lagre en ny Skann-liste med filter og orgnr",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        orgnrs: { type: "array", items: { type: "string" } },
        municipalityCode: { type: "string" },
        regionId: { type: "string" },
        industryGroup: { type: "string" },
        professionId: { type: "string" },
        days: { type: "number" },
      },
      required: ["name", "orgnrs"],
      additionalProperties: false,
    },
  },
  {
    name: "update_saved_list",
    description: "Oppdater lagret Skann-liste (navn, gruppe, legg til/fjern orgnr)",
    parameters: {
      type: "object",
      properties: {
        listId: { type: "string" },
        name: { type: "string" },
        group: { type: "string" },
        addOrgnrs: { type: "array", items: { type: "string" } },
        removeOrgnrs: { type: "array", items: { type: "string" } },
      },
      required: ["listId"],
      additionalProperties: false,
    },
  },
  {
    name: "request_delete_confirm",
    description:
      "Start dobbel slett-bekreftelse. Kall ALLTID dette FØRST når brukeren ber om å slette. Emitter bekreftelse til UI. Slett aldri direkte.",
    parameters: {
      type: "object",
      properties: {
        resourceType: {
          type: "string",
          enum: ["saved_list", "smartliste", "lead"],
        },
        resourceId: { type: "string", description: "listId eller orgnr" },
        resourceName: { type: "string" },
      },
      required: ["resourceType", "resourceId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_saved_list",
    description:
      "Slett lagret Skann-liste. Krev confirmToken fra request_delete_confirm etter at brukeren har bekreftet «Ja, jeg er sikker».",
    parameters: {
      type: "object",
      properties: {
        listId: { type: "string" },
        confirmToken: { type: "string" },
      },
      required: ["listId", "confirmToken"],
      additionalProperties: false,
    },
  },
  {
    name: "list_smartlists",
    description: "List brukerens Smartliste-tavler",
    parameters: EMPTY_PARAMS,
  },
  {
    name: "create_smartlist",
    description: "Opprett Smartliste-tavle (static eller dynamic)",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        listKind: { type: "string", enum: ["static", "dynamic"] },
        filters: { type: "object" },
        boardConfig: { type: "object" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_smartlist",
    description: "Oppdater Smartliste (navn/config/kind)",
    parameters: {
      type: "object",
      properties: {
        listId: { type: "string" },
        name: { type: "string" },
        listKind: { type: "string", enum: ["static", "dynamic"] },
        filters: { type: "object" },
        boardConfig: { type: "object" },
      },
      required: ["listId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_smartlist",
    description:
      "Slett Smartliste. Krev confirmToken etter request_delete_confirm + brukerbekreftelse.",
    parameters: {
      type: "object",
      properties: {
        listId: { type: "string" },
        confirmToken: { type: "string" },
      },
      required: ["listId", "confirmToken"],
      additionalProperties: false,
    },
  },
  {
    name: "smartlist_add_items",
    description: "Legg firma (orgnr) inn på Smartliste",
    parameters: {
      type: "object",
      properties: {
        listId: { type: "string" },
        orgnrs: { type: "array", items: { type: "string" } },
        laneId: { type: "string" },
      },
      required: ["listId", "orgnrs"],
      additionalProperties: false,
    },
  },
  {
    name: "smartlist_update_items",
    description: "Oppdater Smartliste-kort (lane, labels, notes, rank)",
    parameters: {
      type: "object",
      properties: {
        listId: { type: "string" },
        patches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              orgnr: { type: "string" },
              laneId: { type: "string" },
              notes: { type: "string" },
              labelIds: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      required: ["listId", "patches"],
      additionalProperties: false,
    },
  },
  {
    name: "smartlist_remove_items",
    description: "Fjern kort fra Smartliste (ikke slett hele tavlen)",
    parameters: {
      type: "object",
      properties: {
        listId: { type: "string" },
        orgnrs: { type: "array", items: { type: "string" } },
      },
      required: ["listId", "orgnrs"],
      additionalProperties: false,
    },
  },
  {
    name: "set_lead_status",
    description:
      "Sett pipeline-status for lead (ny, kontaktet, svarte, moete_booket, vunnet, tapt, ikke_interessert). queue=true legger i ringekø.",
    parameters: {
      type: "object",
      properties: {
        orgnr: { type: "string" },
        status: {
          type: "string",
          enum: [
            "ny",
            "kontaktet",
            "svarte",
            "moete_booket",
            "vunnet",
            "tapt",
            "ikke_interessert",
          ],
        },
        queue: { type: "boolean" },
        unqueue: { type: "boolean" },
      },
      required: ["orgnr", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "update_lead",
    description: "Oppdater lead-notater / oppfølgingsdato / status",
    parameters: {
      type: "object",
      properties: {
        orgnr: { type: "string" },
        notes: { type: "string" },
        followUpAt: { type: "string", description: "ISO-dato" },
        status: { type: "string" },
      },
      required: ["orgnr"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_lead",
    description:
      "Slett lead fra pipeline. Krev confirmToken etter request_delete_confirm + brukerbekreftelse.",
    parameters: {
      type: "object",
      properties: {
        orgnr: { type: "string" },
        confirmToken: { type: "string" },
      },
      required: ["orgnr", "confirmToken"],
      additionalProperties: false,
    },
  },
  {
    name: "set_company_phone",
    description: "Sett manuelt telefonnummer på firma",
    parameters: {
      type: "object",
      properties: {
        orgnr: { type: "string" },
        phone: { type: "string" },
      },
      required: ["orgnr", "phone"],
      additionalProperties: false,
    },
  },
  {
    name: "start_ai_call",
    description:
      "Start utgående AI-samtale (ElevenLabs/SIP) til firma. Bare når brukeren eksplisitt ber om å ringe.",
    parameters: {
      type: "object",
      properties: {
        orgnr: { type: "string" },
        listId: { type: "string" },
      },
      required: ["orgnr"],
      additionalProperties: false,
    },
  },
  {
    name: "hangup_ai_call",
    description: "Legg på aktivt AI-kall",
    parameters: {
      type: "object",
      properties: {
        callId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "send_sms",
    description: "Send SMS til firma. Bare når brukeren eksplisitt ber om det.",
    parameters: {
      type: "object",
      properties: {
        orgnr: { type: "string" },
        message: { type: "string" },
      },
      required: ["orgnr", "message"],
      additionalProperties: false,
    },
  },
  {
    name: "get_settings",
    description: "Hent brukerinnstillinger (webhook, ukentlig varsel)",
    parameters: EMPTY_PARAMS,
  },
  {
    name: "update_settings",
    description: "Oppdater webhook-URL / ukentlig varsel",
    parameters: {
      type: "object",
      properties: {
        webhookUrl: { type: "string" },
        weeklyAlertEnabled: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "web_search",
    description:
      "Søk på internett (Serper) etter fakta, bedriftsinfo, bransjetrender når brukeren ber om noe spesifikt utenfor NyLead-DB.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        num: { type: "number" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

export const AGENT_OPENAI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] =
  AGENT_FUNCTION_DEFS.map((def) => ({
    type: "function" as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: def.parameters,
    },
  }));

/** Responses API tools: custom functions + hosted web search. */
export const AGENT_RESPONSES_TOOLS: OpenAI.Responses.Tool[] = [
  ...AGENT_FUNCTION_DEFS.map((def) => ({
    type: "function" as const,
    name: def.name,
    description: def.description,
    parameters: def.parameters,
    strict: false,
  })),
  { type: "web_search_preview" as const },
];
