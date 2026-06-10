import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i}`}>{token.slice(2, -2)}</strong>
      );
    } else {
      nodes.push(
        <code key={`${keyPrefix}-c-${i}`} className="agent-chat-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
    i += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

function renderMarkdown(content: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const segments = content.split(/(```[\s\S]*?```)/g);
  let blockIndex = 0;

  for (const segment of segments) {
    if (!segment) continue;

    if (segment.startsWith("```") && segment.endsWith("```")) {
      const inner = segment.slice(3, -3);
      const firstNewline = inner.indexOf("\n");
      const code =
        firstNewline === -1 ? inner.trim() : inner.slice(firstNewline + 1).trimEnd();
      blocks.push(
        <pre key={`code-${blockIndex}`} className="agent-chat-code-block">
          <code>{code}</code>
        </pre>
      );
      blockIndex += 1;
      continue;
    }

    const lines = segment.split("\n");
    let lineIndex = 0;

    while (lineIndex < lines.length) {
      const line = lines[lineIndex];

      if (/^[-*]\s+/.test(line)) {
        const items: ReactNode[] = [];
        while (lineIndex < lines.length && /^[-*]\s+/.test(lines[lineIndex])) {
          const itemText = lines[lineIndex].replace(/^[-*]\s+/, "");
          items.push(
            <li key={`li-${blockIndex}-${lineIndex}`}>
              {renderInline(itemText, `ul-${blockIndex}-${lineIndex}`)}
            </li>
          );
          lineIndex += 1;
        }
        blocks.push(
          <ul key={`ul-${blockIndex}`} className="agent-chat-list">
            {items}
          </ul>
        );
        blockIndex += 1;
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        const items: ReactNode[] = [];
        while (lineIndex < lines.length && /^\d+\.\s+/.test(lines[lineIndex])) {
          const itemText = lines[lineIndex].replace(/^\d+\.\s+/, "");
          items.push(
            <li key={`oli-${blockIndex}-${lineIndex}`}>
              {renderInline(itemText, `ol-${blockIndex}-${lineIndex}`)}
            </li>
          );
          lineIndex += 1;
        }
        blocks.push(
          <ol key={`ol-${blockIndex}`} className="agent-chat-list agent-chat-list--ordered">
            {items}
          </ol>
        );
        blockIndex += 1;
        continue;
      }

      if (!line.trim()) {
        lineIndex += 1;
        continue;
      }

      const paragraphLines: string[] = [];
      while (
        lineIndex < lines.length &&
        lines[lineIndex].trim() &&
        !/^[-*]\s+/.test(lines[lineIndex]) &&
        !/^\d+\.\s+/.test(lines[lineIndex])
      ) {
        paragraphLines.push(lines[lineIndex]);
        lineIndex += 1;
      }

      blocks.push(
        <p key={`p-${blockIndex}`}>
          {renderInline(paragraphLines.join(" "), `p-${blockIndex}`)}
        </p>
      );
      blockIndex += 1;
    }
  }

  return blocks;
}

export function AgentMessageContent({
  content,
  variant,
}: {
  content: string;
  variant: "user" | "assistant";
}) {
  if (!content.trim()) return null;

  if (variant === "user") {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  return (
    <div className={cn("agent-chat-prose", !content.trim() && "min-h-[1.25rem]")}>
      {renderMarkdown(content)}
    </div>
  );
}
