"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { TranscriptEngine } from "@/lib/ring/transcribe-client";
import { Copy, Eraser, Loader2, Mic, MicOff, Sparkles } from "lucide-react";

type Props = {
  isListening: boolean;
  isProcessing: boolean;
  engine: TranscriptEngine;
  whisperAvailable: boolean | null;
  displayText: string;
  transcript: string;
  interim: string;
  supported: boolean;
  error: string | null;
  onToggle: () => void;
  onClear: () => void;
  onEdit: (value: string) => void;
  companyName?: string;
};

export function RingTranscriptPanel({
  isListening,
  isProcessing,
  engine,
  whisperAvailable,
  displayText,
  transcript,
  interim,
  supported,
  error,
  onToggle,
  onClear,
  onEdit,
  companyName,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [displayText, isProcessing]);

  async function copyText() {
    const text = (transcript || displayText).trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }

  const engineLabel =
    engine === "whisper"
      ? "AI (Whisper)"
      : "Nettleser";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Transkript
          </p>
          <p className="truncate text-sm font-semibold text-white">
            {companyName ?? "Samtale"}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
            {engine === "whisper" ? (
              <Sparkles className="h-3 w-3 text-sky-400" />
            ) : null}
            {engineLabel}
            {whisperAvailable === false ? " · AI utilgjengelig" : null}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void copyText()}
            disabled={!displayText.trim() && !transcript.trim()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/10 disabled:opacity-40"
            title="Kopiér transkript"
            aria-label="Kopiér transkript"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!displayText.trim() && !transcript.trim()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/10 disabled:opacity-40"
            title="Tøm transkript"
            aria-label="Tøm transkript"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={!supported}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
              isListening
                ? "bg-red-500/20 text-red-200 ring-1 ring-red-400/40"
                : "border border-white/10 text-slate-300 hover:bg-white/10",
              !supported && "opacity-50"
            )}
            title={isListening ? "Stopp transkripsjon" : "Start transkripsjon"}
          >
            {isListening ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <MicOff className="h-3.5 w-3.5" />
                Stopp
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" />
                Lytt
              </>
            )}
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!supported ? (
          <p className="text-sm text-slate-500">
            Opptak krever en moderne nettleser med mikrofonstøtte.
          </p>
        ) : (
          <>
            <textarea
              value={transcript}
              onChange={(e) => onEdit(e.target.value)}
              placeholder={
                isListening
                  ? engine === "whisper"
                    ? "AI transkriberer norsk hvert ~8. sekund… Du kan også skrive eller rette her."
                    : "Lytter… Tekst dukker opp underveis. Rett gjerne feil her."
                  : "Trykk Lytt for å starte. Teksten kan redigeres manuelt etterpå."
              }
              className="min-h-[12rem] w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/40"
            />
            {interim ? (
              <p className="mt-2 text-xs italic text-slate-400">Hører: {interim}</p>
            ) : null}
            {isProcessing ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-sky-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                AI transkriberer siste lydbit…
              </p>
            ) : null}
          </>
        )}
      </div>

      {error ? (
        <p className="border-t border-white/10 px-4 py-2 text-xs text-amber-300">{error}</p>
      ) : null}
      {isListening ? (
        <p className="border-t border-white/10 px-4 py-2 text-[10px] leading-relaxed text-slate-500">
          Tips for bedre treff: bruk headset, rolig rom, og høyttaler på telefonen hvis du ringer
          fra mobil. AI-modus oppdateres ca. hvert 8. sekund.
        </p>
      ) : null}
    </div>
  );
}
