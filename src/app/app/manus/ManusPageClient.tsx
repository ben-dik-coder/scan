"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ManusEditor,
  type ManusEditorHandle,
} from "@/components/manus/ManusEditor";
import { MANUS_PLACEHOLDERS, MANUS_TEMPLATES } from "@/lib/manus/manus-templates";
import { useManusDocument } from "@/lib/manus/use-manus-document";
import {
  countWords,
  browserFindInPage,
  downloadTextFile,
  estimateReadingMinutes,
  extractHeadings,
  htmlToPlainText,
  loadManusNotes,
  printManus,
  saveManusNotes,
} from "@/lib/manus/manus-utils";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  EyeOff,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeft,
  PanelRight,
  Play,
  Printer,
  Save,
  Search,
  Sparkles,
  Square,
} from "lucide-react";

type Panel = "left" | "right" | "both" | "none";

export function ManusPageClient() {
  const editorRef = useRef<ManusEditorHandle>(null);
  const {
    title,
    bodyHtml,
    loading,
    saveState,
    error,
    dirty,
    setTitle,
    setBodyHtml,
    replaceDocument,
    handleSave,
  } = useManusDocument(true);

  const [panels, setPanels] = useState<Panel>("both");
  const [focusMode, setFocusMode] = useState(false);
  const [teleprompter, setTeleprompter] = useState(false);
  const [teleprompterPlaying, setTeleprompterPlaying] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(40);
  const [fontScale, setFontScale] = useState<"sm" | "base" | "lg" | "xl">("base");
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState(() => loadManusNotes());
  const [exportOpen, setExportOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const plainText = useMemo(() => htmlToPlainText(bodyHtml), [bodyHtml]);
  const words = useMemo(() => countWords(plainText), [plainText]);
  const readingMinutes = useMemo(() => estimateReadingMinutes(words), [words]);
  const headings = useMemo(() => extractHeadings(bodyHtml), [bodyHtml]);

  const showLeft = !focusMode && (panels === "left" || panels === "both");
  const showRight = !focusMode && (panels === "right" || panels === "both");

  function flash(msg: string) {
    setMessage(msg);
    window.setTimeout(() => setMessage(null), 2200);
  }

  function applyTemplate(templateId: string) {
    const template = MANUS_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const ok =
      !bodyHtml.trim() ||
      window.confirm(`Erstatt manuset med malen «${template.name}»?`);
    if (!ok) return;
    replaceDocument({ title: template.name, bodyHtml: template.html });
    flash(`Mal «${template.name}» er lagt inn`);
  }

  function insertPlaceholder(token: string) {
    if (token === "{{dato}}") {
      const formatted = new Date().toLocaleDateString("nb-NO");
      editorRef.current?.insertText(formatted);
    } else {
      editorRef.current?.insertText(token);
    }
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    saveManusNotes(value);
  }

  async function copyPlain() {
    await navigator.clipboard.writeText(plainText);
    flash("Kopierte som ren tekst");
  }

  async function copyHtml() {
    await navigator.clipboard.writeText(bodyHtml);
    flash("Kopierte HTML");
  }

  function downloadHtml() {
    downloadTextFile(
      `${slugify(title)}.html`,
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${bodyHtml}</body></html>`,
      "text/html;charset=utf-8"
    );
  }

  function downloadTxt() {
    downloadTextFile(`${slugify(title)}.txt`, plainText, "text/plain;charset=utf-8");
  }

  function runSearch() {
    if (!searchQuery.trim()) return;
    editorRef.current?.focus();
    const found = browserFindInPage(searchQuery);
    if (!found) flash("Fant ikke teksten");
  }

  const statusLabel =
    saveState === "saving"
      ? "Lagrer…"
      : saveState === "saved" && !dirty
        ? "Lagret"
        : dirty
          ? "Ulagrede endringer"
          : "Klar";

  if (teleprompter) {
    return (
      <TeleprompterView
        text={plainText}
        playing={teleprompterPlaying}
        speed={teleprompterSpeed}
        onPlayToggle={() => setTeleprompterPlaying((p) => !p)}
        onSpeedChange={setTeleprompterSpeed}
        onClose={() => {
          setTeleprompter(false);
          setTeleprompterPlaying(false);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[#141416] text-slate-100">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#1c1c1e]/95 px-3 py-2 backdrop-blur-md sm:px-4">
        <Link
          href="/app/oversikt"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Tilbake"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-slate-500 sm:text-lg"
          placeholder="Tittel på manus"
          aria-label="Tittel"
        />

        <div className="flex flex-wrap items-center gap-1">
          <ToolbarButton
            label={focusMode ? "Vis paneler" : "Fokusmodus"}
            active={focusMode}
            onClick={() => setFocusMode((v) => !v)}
          >
            {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </ToolbarButton>

          <ToolbarButton
            label="Teleprompter"
            onClick={() => setTeleprompter(true)}
          >
            <Play className="h-4 w-4" />
          </ToolbarButton>

          <div className="relative">
            <ToolbarButton label="Eksporter" onClick={() => setExportOpen((v) => !v)}>
              <Download className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 opacity-60" />
            </ToolbarButton>
            {exportOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Lukk meny"
                  onClick={() => setExportOpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-xl border border-white/10 bg-[#2c2c2e] p-1 shadow-xl">
                  <ExportItem icon={Copy} label="Kopiér tekst" onClick={() => { void copyPlain(); setExportOpen(false); }} />
                  <ExportItem icon={Copy} label="Kopiér HTML" onClick={() => { void copyHtml(); setExportOpen(false); }} />
                  <ExportItem icon={Download} label="Last ned .txt" onClick={() => { downloadTxt(); setExportOpen(false); }} />
                  <ExportItem icon={Download} label="Last ned .html" onClick={() => { downloadHtml(); setExportOpen(false); }} />
                  <ExportItem icon={Printer} label="Skriv ut" onClick={() => { printManus(title, bodyHtml); setExportOpen(false); }} />
                </div>
              </>
            ) : null}
          </div>

          <select
            value={fontScale}
            onChange={(e) => setFontScale(e.target.value as typeof fontScale)}
            className="h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-slate-200 outline-none"
            aria-label="Skriftstørrelse"
          >
            <option value="sm">Liten</option>
            <option value="base">Normal</option>
            <option value="lg">Stor</option>
            <option value="xl">Ekstra stor</option>
          </select>

          {!focusMode ? (
            <>
              <ToolbarButton
                label="Venstre panel"
                active={showLeft}
                onClick={() =>
                  setPanels((p) =>
                    p === "left" || p === "both" ? (showRight ? "right" : "none") : "both"
                  )
                }
              >
                <PanelLeft className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                label="Høyre panel"
                active={showRight}
                onClick={() =>
                  setPanels((p) =>
                    p === "right" || p === "both" ? (showLeft ? "left" : "none") : "both"
                  )
                }
              >
                <PanelRight className="h-4 w-4" />
              </ToolbarButton>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saveState === "saving"}
            className="scan-btn-primary inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-50"
          >
            {saveState === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lagre
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showLeft ? (
          <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-white/10 bg-[#18181a] p-3 lg:block xl:w-72">
            <SidebarSection title="Maler">
              {MANUS_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template.id)}
                  className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition hover:border-sky-400/30 hover:bg-white/10"
                >
                  <p className="text-sm font-semibold text-white">{template.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{template.description}</p>
                </button>
              ))}
            </SidebarSection>

            <SidebarSection title="Plassholdere">
              <div className="flex flex-wrap gap-1.5">
                {MANUS_PLACEHOLDERS.map(({ token, label }) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertPlaceholder(token)}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-sky-400/40 hover:text-white"
                    title={label}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </SidebarSection>

            <SidebarSection title="Innholdsfortegnelse">
              {headings.length === 0 ? (
                <p className="text-xs text-slate-500">Legg til overskrifter (H1–H3) i manuset.</p>
              ) : (
                <ul className="space-y-1">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <button
                        type="button"
                        onClick={() => {
                          editorRef.current?.focus();
                          browserFindInPage(heading.text);
                        }}
                        className={cn(
                          "w-full truncate rounded-md px-2 py-1 text-left text-xs text-slate-300 hover:bg-white/10",
                          heading.level === 2 && "pl-4",
                          heading.level === 3 && "pl-6"
                        )}
                      >
                        {heading.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SidebarSection>
          </aside>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
          {!focusMode ? (
            <div className="mb-3 space-y-2 lg:hidden">
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) applyTemplate(e.target.value);
                  e.target.value = "";
                }}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 outline-none"
                aria-label="Velg mal"
              >
                <option value="">Velg mal…</option>
                {MANUS_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {MANUS_PLACEHOLDERS.map(({ token, label }) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertPlaceholder(token)}
                    className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-300"
                    title={label}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Henter manus…
            </div>
          ) : (
            <ManusEditor
              ref={editorRef}
              html={bodyHtml}
              fontScale={fontScale}
              compactToolbar={focusMode}
              placeholder="Skriv innledning, spørsmål, innvendinger, avslutning og notater til samtalen…"
              onChange={setBodyHtml}
            />
          )}
        </main>

        {showRight ? (
          <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-white/10 bg-[#18181a] p-3 lg:block xl:w-72">
            <SidebarSection title="Statistikk">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="Ord" value={String(words)} />
                <Stat label="Tegn" value={String(plainText.length)} />
                <Stat label="Lesetid" value={`~${readingMinutes} min`} />
                <Stat label="Overskrifter" value={String(headings.length)} />
              </dl>
            </SidebarSection>

            <SidebarSection title="Søk i manus">
              <div className="flex gap-1">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="Søk…"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs outline-none focus:border-sky-400/40"
                />
                <button
                  type="button"
                  onClick={runSearch}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-slate-200 hover:bg-white/15"
                  aria-label="Søk"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </SidebarSection>

            <SidebarSection title="Notater (lagres lokalt)">
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                rows={8}
                placeholder="Egne notater, tips, innvendinger du hører ofte…"
                className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs leading-relaxed text-slate-200 outline-none focus:border-sky-400/40"
              />
            </SidebarSection>

            <SidebarSection title="Snarveier">
              <ul className="space-y-1 text-[11px] text-slate-400">
                <li><kbd className="rounded bg-white/10 px-1">⌘/Ctrl+S</kbd> Lagre</li>
                <li><kbd className="rounded bg-white/10 px-1">⌘/Ctrl+B</kbd> Fet tekst</li>
                <li><kbd className="rounded bg-white/10 px-1">⌘/Ctrl+I</kbd> Kursiv</li>
                <li><kbd className="rounded bg-white/10 px-1">⌘/Ctrl+Z</kbd> Angre</li>
              </ul>
            </SidebarSection>
          </aside>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#1c1c1e]/90 px-3 py-2 text-[11px] text-slate-400 sm:px-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1",
              saveState === "saved" && !dirty && "text-emerald-400",
              saveState === "error" && "text-amber-300"
            )}
          >
            {saveState === "saved" && !dirty ? <Check className="h-3 w-3" /> : null}
            {statusLabel}
          </span>
          <span>{words} ord</span>
          <span>~{readingMinutes} min å lese høyt</span>
          {message ? <span className="text-sky-300">{message}</span> : null}
          {error ? <span className="text-amber-300">{error}</span> : null}
        </div>
        <span className="inline-flex items-center gap-1 text-slate-500">
          <Sparkles className="h-3 w-3" />
          Auto-lagring aktiv
        </span>
      </footer>
    </div>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-lg border border-white/10 px-2 text-slate-300 transition hover:bg-white/10 hover:text-white",
        active && "border-sky-400/40 bg-sky-500/15 text-sky-100"
      )}
    >
      {children}
    </button>
  );
}

function ExportItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-200 hover:bg-white/10"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      {label}
    </button>
  );
}

function TeleprompterView({
  text,
  playing,
  speed,
  onPlayToggle,
  onSpeedChange,
  onClose,
}: {
  text: string;
  playing: boolean;
  speed: number;
  onPlayToggle: () => void;
  onSpeedChange: (value: number) => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) return;
    const el = scrollRef.current;
    if (!el) return;

    let frame = 0;
    const tick = () => {
      el.scrollTop += speed / 30;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
        el.scrollTop = 0;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, speed]);

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
        >
          <EyeOff className="h-4 w-4" />
          Avslutt
        </button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Hastighet
            <input
              type="range"
              min={10}
              max={120}
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            onClick={onPlayToggle}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            {playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause" : "Spill av"}
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-[10vw] py-[20vh]"
      >
        <p className="whitespace-pre-wrap text-[clamp(1.5rem,4vw,3rem)] font-medium leading-relaxed">
          {text || "Skriv manus først — så kan du lese det opp her."}
        </p>
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/gi, "-")
    .replace(/^-|-$/g, "") || "manus";
}
