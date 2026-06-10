/** Svar som ser ut som de ble kuttet midt i generering. */
export function isLikelyTruncatedAgentResponse(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (
    /(?:detaljer|resultat|firma|liste)\s*:\s*\d+\.?\s*$/i.test(trimmed) ||
    /(?:^|\n)\s*\d+\.\s*(?:\*\*[^*]*)?\s*$/m.test(trimmed) ||
    /(?:^|\n)\s*\d+\.\s*$/m.test(trimmed)
  ) {
    return true;
  }

  if (
    /kort oppsummering\s*:/i.test(trimmed) &&
    !/(?:^|\n)\s*2\./m.test(trimmed) &&
    /\b[3-9]\s+av\s+\d+\b/i.test(trimmed)
  ) {
    return true;
  }

  if (/…$|\.\.\.$/.test(trimmed)) return true;

  return false;
}

export function isStreamLikelyIncomplete(options: {
  assistantText: string;
  receivedDone: boolean;
  hadActiveTool: boolean;
}): boolean {
  const { assistantText, receivedDone, hadActiveTool } = options;
  const trimmed = assistantText.trim();

  if (!trimmed) {
    return !receivedDone;
  }

  if (!receivedDone) return true;
  if (hadActiveTool && isLikelyTruncatedAgentResponse(trimmed)) return true;

  return false;
}
