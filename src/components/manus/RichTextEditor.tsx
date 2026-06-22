"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";

type Props = {
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

type ToolbarAction = {
  label: string;
  icon: LucideIcon;
  command: () => void;
  active?: () => boolean;
};

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function RichTextEditor({
  html,
  onChange,
  placeholder = "Skriv manuset ditt her…",
  disabled = false,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const syncingRef = useRef(false);

  const syncFromEditor = useCallback(() => {
    const node = editorRef.current;
    if (!node || syncingRef.current) return;
    onChange(node.innerHTML);
  }, [onChange]);

  useEffect(() => {
    const node = editorRef.current;
    if (!node) return;
    if (node.innerHTML === html) return;
    syncingRef.current = true;
    node.innerHTML = html;
    syncingRef.current = false;
  }, [html]);

  const toolbarGroups: ToolbarAction[][] = [
    [
      {
        label: "Fet",
        icon: Bold,
        command: () => exec("bold"),
        active: () => document.queryCommandState("bold"),
      },
      {
        label: "Kursiv",
        icon: Italic,
        command: () => exec("italic"),
        active: () => document.queryCommandState("italic"),
      },
      {
        label: "Understrek",
        icon: Underline,
        command: () => exec("underline"),
        active: () => document.queryCommandState("underline"),
      },
      {
        label: "Gjennomstrek",
        icon: Strikethrough,
        command: () => exec("strikeThrough"),
        active: () => document.queryCommandState("strikeThrough"),
      },
    ],
    [
      {
        label: "Overskrift 1",
        icon: Heading1,
        command: () => exec("formatBlock", "h1"),
      },
      {
        label: "Overskrift 2",
        icon: Heading2,
        command: () => exec("formatBlock", "h2"),
      },
    ],
    [
      {
        label: "Punktliste",
        icon: List,
        command: () => exec("insertUnorderedList"),
      },
      {
        label: "Nummerert liste",
        icon: ListOrdered,
        command: () => exec("insertOrderedList"),
      },
      {
        label: "Sitat",
        icon: Quote,
        command: () => exec("formatBlock", "blockquote"),
      },
    ],
    [
      {
        label: "Lenke",
        icon: Link2,
        command: () => {
          const url = window.prompt("Lim inn lenke (https://…):");
          if (!url?.trim()) return;
          exec("createLink", url.trim());
          syncFromEditor();
        },
      },
      {
        label: "Fjern formatering",
        icon: RemoveFormatting,
        command: () => exec("removeFormat"),
      },
    ],
    [
      {
        label: "Angre",
        icon: Undo2,
        command: () => exec("undo"),
      },
      {
        label: "Gjør om",
        icon: Redo2,
        command: () => exec("redo"),
      },
    ],
  ];

  function run(action: ToolbarAction) {
    editorRef.current?.focus();
    action.command();
    syncFromEditor();
  }

  const showPlaceholder = !html.replace(/<[^>]*>/g, "").trim();

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20",
        focused && "ring-1 ring-sky-400/40"
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 p-2">
        {toolbarGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="flex items-center gap-0.5">
            {groupIndex > 0 ? (
              <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />
            ) : null}
            {group.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  title={action.label}
                  aria-label={action.label}
                  disabled={disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => run(action)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        {showPlaceholder && !focused ? (
          <p className="pointer-events-none absolute left-4 top-3 text-sm text-slate-500">
            {placeholder}
          </p>
        ) : null}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Manus"
          onInput={syncFromEditor}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            syncFromEditor();
          }}
          className={cn(
            "manus-editor min-h-[min(60vh,520px)] overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none",
            "[&_a]:text-sky-400 [&_a]:underline",
            "[&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-300",
            "[&_h1]:mb-3 [&_h1]:mt-1 [&_h1]:text-xl [&_h1]:font-bold",
            "[&_h2]:mb-2 [&_h2]:mt-1 [&_h2]:text-lg [&_h2]:font-semibold",
            "[&_li]:ml-4 [&_ol]:my-2 [&_ol]:list-decimal [&_ul]:my-2 [&_ul]:list-disc",
            "[&_p]:my-2",
            disabled && "opacity-60"
          )}
        />
      </div>
    </div>
  );
}
