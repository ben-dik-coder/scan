"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";

export type ManusEditorHandle = {
  focus: () => void;
  insertHtml: (html: string) => void;
  insertText: (text: string) => void;
  exec: (command: string, value?: string) => void;
};

type Props = {
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  compactToolbar?: boolean;
  fontScale?: "sm" | "base" | "lg" | "xl";
  onFocusChange?: (focused: boolean) => void;
};

type ToolbarItem = {
  label: string;
  icon: LucideIcon;
  command: () => void;
  active?: () => boolean;
};

const TEXT_COLORS = ["#ffffff", "#fbbf24", "#34d399", "#60a5fa", "#f87171", "#c084fc"];
const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bae6fd", "#fecaca", "#e9d5ff", "transparent"];

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export const ManusEditor = forwardRef<ManusEditorHandle, Props>(function ManusEditor(
  {
    html,
    onChange,
    placeholder = "Skriv manuset ditt her…",
    disabled = false,
    compactToolbar = false,
    fontScale = "base",
    onFocusChange,
  },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [toolbarTick, setToolbarTick] = useState(0);
  const syncingRef = useRef(false);

  const syncFromEditor = useCallback(() => {
    const node = editorRef.current;
    if (!node || syncingRef.current) return;
    onChange(node.innerHTML);
    setToolbarTick((n) => n + 1);
  }, [onChange]);

  useEffect(() => {
    const node = editorRef.current;
    if (!node) return;
    if (node.innerHTML === html) return;
    syncingRef.current = true;
    node.innerHTML = html;
    syncingRef.current = false;
  }, [html]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editorRef.current?.focus(),
      insertHtml: (snippet) => {
        editorRef.current?.focus();
        exec("insertHTML", snippet);
        syncFromEditor();
      },
      insertText: (text) => {
        editorRef.current?.focus();
        exec("insertText", text);
        syncFromEditor();
      },
      exec: (command, value) => {
        editorRef.current?.focus();
        exec(command, value);
        syncFromEditor();
      },
    }),
    [syncFromEditor]
  );

  function run(action: ToolbarItem) {
    editorRef.current?.focus();
    action.command();
    syncFromEditor();
  }

  const formatGroups: ToolbarItem[][] = [
    [
      { label: "Angre", icon: Undo2, command: () => exec("undo") },
      { label: "Gjør om", icon: Redo2, command: () => exec("redo") },
    ],
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
      { label: "Subscript", icon: Subscript, command: () => exec("subscript") },
      { label: "Superscript", icon: Superscript, command: () => exec("superscript") },
    ],
    [
      { label: "Avsnitt", icon: Pilcrow, command: () => exec("formatBlock", "p") },
      { label: "Overskrift 1", icon: Heading1, command: () => exec("formatBlock", "h1") },
      { label: "Overskrift 2", icon: Heading2, command: () => exec("formatBlock", "h2") },
      { label: "Overskrift 3", icon: Heading3, command: () => exec("formatBlock", "h3") },
    ],
    [
      { label: "Punktliste", icon: List, command: () => exec("insertUnorderedList") },
      { label: "Nummerert liste", icon: ListOrdered, command: () => exec("insertOrderedList") },
      { label: "Sitat", icon: Quote, command: () => exec("formatBlock", "blockquote") },
      { label: "Kode", icon: Code, command: () => exec("formatBlock", "pre") },
      { label: "Horisontal linje", icon: Minus, command: () => exec("insertHorizontalRule") },
    ],
    [
      { label: "Venstre", icon: AlignLeft, command: () => exec("justifyLeft") },
      { label: "Midt", icon: AlignCenter, command: () => exec("justifyCenter") },
      { label: "Høyre", icon: AlignRight, command: () => exec("justifyRight") },
      { label: "Justert", icon: AlignJustify, command: () => exec("justifyFull") },
      { label: "Innrykk", icon: IndentIncrease, command: () => exec("indent") },
      { label: "Reduser innrykk", icon: IndentDecrease, command: () => exec("outdent") },
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
      { label: "Fjern lenke", icon: Unlink, command: () => exec("unlink") },
      { label: "Fjern formatering", icon: RemoveFormatting, command: () => exec("removeFormat") },
    ],
  ];

  void toolbarTick;

  const showPlaceholder = !html.replace(/<[^>]*>/g, "").trim();

  const fontScaleClass =
    fontScale === "sm"
      ? "text-sm"
      : fontScale === "lg"
        ? "text-lg"
        : fontScale === "xl"
          ? "text-xl leading-loose"
          : "text-base";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/25",
        focused && "ring-1 ring-sky-400/35"
      )}
    >
      {!compactToolbar ? (
        <div className="max-h-[140px] overflow-y-auto border-b border-white/10 p-2">
          {formatGroups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              className={cn(
                "flex flex-wrap items-center gap-0.5",
                groupIndex > 0 && "mt-1 border-t border-white/5 pt-1"
              )}
            >
              {group.map((action) => {
                const Icon = action.icon;
                const isActive = action.active?.();
                return (
                  <button
                    key={action.label}
                    type="button"
                    title={action.label}
                    aria-label={action.label}
                    disabled={disabled}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => run(action)}
                    className={cn(
                      "flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40",
                      isActive && "bg-sky-500/20 text-sky-200"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
              {groupIndex === formatGroups.length - 2 ? (
                <>
                  <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />
                  <div className="flex items-center gap-1">
                    <Palette className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                    {TEXT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={`Tekstfarge ${color}`}
                        disabled={disabled}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          editorRef.current?.focus();
                          exec("foreColor", color);
                          syncFromEditor();
                        }}
                        className="h-5 w-5 rounded-full border border-white/20"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <Highlighter className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                    {HIGHLIGHT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={color === "transparent" ? "Fjern markering" : `Markering ${color}`}
                        disabled={disabled}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          editorRef.current?.focus();
                          exec("hiliteColor", color === "transparent" ? "transparent" : color);
                          syncFromEditor();
                        }}
                        className={cn(
                          "h-5 w-5 rounded border border-white/20",
                          color === "transparent" && "bg-white/10"
                        )}
                        style={color === "transparent" ? undefined : { backgroundColor: color }}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {showPlaceholder && !focused ? (
          <p className="pointer-events-none absolute left-6 top-5 text-slate-500">{placeholder}</p>
        ) : null}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Manus"
          onInput={syncFromEditor}
          onKeyUp={syncFromEditor}
          onMouseUp={syncFromEditor}
          onFocus={() => {
            setFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setFocused(false);
            onFocusChange?.(false);
            syncFromEditor();
          }}
          className={cn(
            "manus-editor h-full min-h-[calc(100dvh-14rem)] overflow-y-auto px-6 py-5 leading-relaxed text-slate-100 outline-none sm:min-h-[calc(100dvh-12rem)]",
            fontScaleClass,
            "[&_a]:text-sky-400 [&_a]:underline",
            "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-sky-400/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-300",
            "[&_h1]:mb-4 [&_h1]:mt-2 [&_h1]:text-2xl [&_h1]:font-bold",
            "[&_h2]:mb-3 [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-semibold",
            "[&_h3]:mb-2 [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-semibold",
            "[&_li]:ml-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ul]:my-3 [&_ul]:list-disc",
            "[&_p]:my-3",
            "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-white/10 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm",
            "[&_hr]:my-6 [&_hr]:border-white/15",
            disabled && "opacity-60"
          )}
        />
      </div>
    </div>
  );
});
