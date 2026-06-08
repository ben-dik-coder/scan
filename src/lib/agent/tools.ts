import type OpenAI from "openai";

export const AGENT_OPENAI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_entitlements",
      description: "Hent brukerens gjenværende kontakt-kvote denne måneden",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "search_companies",
      description:
        "Søk firma i Brreg-databasen etter kommune, region, bransje eller yrke",
      parameters: {
        type: "object",
        properties: {
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
              "Antall dager tilbake (0 = alle tider). Standard 30, men 0 når industryGroup/professionId er satt",
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
        "Skann nettside for en liste med orgnr (maks 100). Søker også etter Facebook-side. Må kjøres før filter_no_website.",
      parameters: {
        type: "object",
        properties: {
          orgnrs: {
            type: "array",
            items: { type: "string" },
            description: "Liste med organisasjonsnummer",
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
