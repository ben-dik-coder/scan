import type OpenAI from "openai";
import {
  AGENT_MAX_FAST_LIST_LIMIT,
  AGENT_MAX_SCAN_PER_CALL,
} from "@/lib/agent/constants";

export const AGENT_OPENAI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_usage",
      description:
        "Hent Serper-kvote og kontakt-kvote for brukeren denne måneden. Kjør før store scan_websites-jobber.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_entitlements",
      description: "Alias for get_usage — kontakt- og Serper-kvote",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_saved_lists",
      description: "List brukerens lagrede lister (navn, filter, antall firma)",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
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
  },
  {
    type: "function",
    function: {
      name: "remember_preference",
      description:
        "Lagre bruker-preferanse for fremtidige samtaler (default_municipality, default_region, default_industry, sales_focus, notes). sales_focus: «website_sales» huskes for lead-søk uten nettside.",
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
  },
  {
    type: "function",
    function: {
      name: "search_companies",
      description:
        "Søk firma i Brreg-databasen etter kommune, region, bransje, yrke eller ord i firmanavn. Ved hurtigliste: sett limit til antall brukeren ba om.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: `Maks antall firma å returnere (1–${AGENT_MAX_FAST_LIST_LIMIT}). Bruk når brukeren ber om f.eks. «5 byggevarehandlere».`,
          },
          municipalityCode: {
            type: "string",
            description: "Kommunenummer, f.eks. 1806 for Narvik",
          },
          regionId: {
            type: "string",
            description: "Region-id, f.eks. oslo, nordland",
          },
          industryGroup: {
            type: "string",
            description:
              "Bransje-id — foretrekk dette fremfor professionId (f.eks. frisor gir flere treff enn yrke frisor)",
          },
          professionId: {
            type: "string",
            description:
              "Yrke-id — smalere enn bransje; bruk industryGroup når mulig (f.eks. frisor)",
          },
          days: {
            type: "number",
            description:
              "Antall dager tilbake (0 = alle tider). Standard 30, men 0 når industryGroup/professionId/nameQuery er satt",
          },
          nameQuery: {
            type: "string",
            description:
              "Søkeord i firmanavn — alle ord må finnes, f.eks. «nails» eller «beauty spa»",
          },
          withoutWebsite: {
            type: "boolean",
            description:
              "Kun firma uten lagret nettside i Brreg. Bruk ved «selge nettside til» / «gode leads uten nettside».",
          },
          excludeIndustryGroups: {
            type: "array",
            items: { type: "string" },
            description:
              "Ekskluder bransjer fra treff — ved nettside-salg: [\"webbyra\",\"it\",\"reklame\"]",
          },
          requirePhone: {
            type: "boolean",
            description: "Kun firma med telefonnummer",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scan_websites",
      description:
        `Skann nettside for en liste med orgnr (maks ${AGENT_MAX_SCAN_PER_CALL} per kall, ~2 Serper-kall per firma uten sosiale tillegg). Kjør BARE når brukeren ber om nettside-skann — aldri automatisk etter søk. Sett includeFacebook/includeInstagram kun når brukeren ber om det.`,
      parameters: {
        type: "object",
        properties: {
          orgnrs: {
            type: "array",
            items: { type: "string" },
            description: "Liste med organisasjonsnummer",
          },
          includeFacebook: {
            type: "boolean",
            description:
              "Søk også etter Facebook (ekstra Serper-kall). Standard false — bruk kun ved «med Facebook».",
          },
          includeInstagram: {
            type: "boolean",
            description:
              "Søk også etter Instagram (ekstra Serper-kall). Standard false.",
          },
        },
        required: ["orgnrs"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enrich_contacts",
      description:
        "Berik telefon og e-post for firma via Brreg og nettside-skann",
      parameters: {
        type: "object",
        properties: {
          orgnrs: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["orgnrs"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "filter_no_website",
      description:
        "Filtrer orgnr til de uten egen nettside. Krever scan_websites — uskannede orgnr utelates og returneres i pendingScan/notScanned",
      parameters: {
        type: "object",
        properties: {
          orgnrs: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["orgnrs"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "filter_leads",
      description:
        "Filtrer orgnr etter skann-resultat: Facebook, telefon, confidence",
      parameters: {
        type: "object",
        properties: {
          orgnrs: { type: "array", items: { type: "string" } },
          facebookOnly: { type: "boolean" },
          hasPhone: { type: "boolean" },
          minConfidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
        },
        required: ["orgnrs"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_list",
      description: "Lagre en lagret liste med filter og orgnr for kunden",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Navn på listen" },
          orgnrs: {
            type: "array",
            items: { type: "string" },
          },
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
  },
];
