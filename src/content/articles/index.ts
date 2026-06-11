import type { ComponentType } from "react";
import { FinnNyeFirmaArticle } from "./finn-nye-firma-a-selge-til";
import { TelefonOgEpostArticle } from "./telefon-og-epost-til-bedrifter";
import { LeadgenereringB2bArticle } from "./leadgenerering-b2b-selgere";
import { BrregFinneKunderArticle } from "./brreg-finne-kunder";
import { FinnFirmaKommuneBransjeArticle } from "./finn-firma-kommune-bransje";
import { KaldKontaktNyeFirmaArticle } from "./kald-kontakt-nye-firma";
import { FolgeOppLeadsArticle } from "./folge-opp-leads";
import { NyregistrerteFirmaArticle } from "./nyregistrerte-firma-norge";
import { FinnKunderMedTelefonArticle } from "./finn-kunder-med-telefon";
import { AiAssistentSalgArticle } from "./ai-assistent-salg-norsk";

export const ARTICLE_CONTENT: Record<string, ComponentType> = {
  "finn-nye-firma-a-selge-til": FinnNyeFirmaArticle,
  "telefon-og-epost-til-bedrifter": TelefonOgEpostArticle,
  "leadgenerering-b2b-selgere": LeadgenereringB2bArticle,
  "brreg-finne-kunder": BrregFinneKunderArticle,
  "finn-firma-kommune-bransje": FinnFirmaKommuneBransjeArticle,
  "kald-kontakt-nye-firma": KaldKontaktNyeFirmaArticle,
  "folge-opp-leads": FolgeOppLeadsArticle,
  "nyregistrerte-firma-norge": NyregistrerteFirmaArticle,
  "finn-kunder-med-telefon": FinnKunderMedTelefonArticle,
  "ai-assistent-salg-norsk": AiAssistentSalgArticle,
};

export function getArticleContent(slug: string): ComponentType | undefined {
  return ARTICLE_CONTENT[slug];
}
