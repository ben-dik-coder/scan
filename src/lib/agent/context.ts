import { getEntitlements } from "@/lib/billing/entitlements";
import { getSerperUsage } from "@/lib/billing/serper-usage";
import { loadUserMemoryPrompt } from "@/lib/agent/user-memory";

export type AgentStartupContext = {
  serperUsed: number;
  serperLimit: number;
  serperRemaining: number;
  contactRemaining: number;
  contactLimit: number;
  userMemoryBlock: string;
};

export async function loadAgentStartupContext(
  userId: string
): Promise<AgentStartupContext> {
  const [serper, entitlements, userMemoryBlock] = await Promise.all([
    getSerperUsage(userId),
    getEntitlements(userId),
    loadUserMemoryPrompt(userId),
  ]);

  return {
    serperUsed: serper.used,
    serperLimit: serper.limit,
    serperRemaining: serper.remaining,
    contactRemaining: entitlements.companiesWithContactRemaining,
    contactLimit: entitlements.maxCompaniesWithContactPerMonth,
    userMemoryBlock,
  };
}

export function buildAgentStartupContextPrompt(ctx: AgentStartupContext): string {
  const lines = [
    "BRUKERKONTEKST (oppdatert ved melding):",
    `- Serper denne måneden: ${ctx.serperUsed} / ${ctx.serperLimit} (${ctx.serperRemaining} igjen). Estimer ~4 Serper-kall per firma ved scan_websites.`,
    `- Kontakt-kvote denne måneden: ${ctx.contactRemaining} av ${ctx.contactLimit} igjen.`,
  ];

  if (ctx.serperRemaining < 200) {
    lines.push(
      "- Serper-kvoten er lav — foreslå mindre batch eller færre firma før du skanner mange."
    );
  }

  if (ctx.userMemoryBlock.trim()) {
    lines.push(ctx.userMemoryBlock.trim());
  }

  return lines.join("\n");
}
