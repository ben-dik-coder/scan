"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Copy, Eraser, Mic, MicOff } from "lucide-react";

type Props = {
  isListening: boolean;
  displayText: string;
  transcript: string;
  interim: string;
  supported: boolean;
  error: string | null;
  onToggle: () => void;
  onClear: () => void;
  companyName?: string;
};

export function RingTranscriptPanel({
  isListening,
  displayText,
  transcript,
  interim,
  supported,
  error,
  onToggle,
  onClear,
  companyName,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [displayText]);

  async function copyText() {
    if (!displayText.trim()) return;
    await navigator.clipboard.writeText(displayText.trim());
  }

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
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void copyText()}
            disabled={!displayText.trim()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/10 disabled:opacity-40"
            title="Kopiér transkript"
            aria-label="Kopiér transkript"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!displayText.trim()}
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

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-slate-200"
      >
        {!supported ? (
          <p className="text-slate-500">
            Transkripsjon krever Chrome eller Edge på Mac/PC. Tillat mikrofon når du blir spurt.
          </p>
        ) : !displayText.trim() ? (
          <p className="text-slate-500">
            {isListening
              ? "Lytter… Snakk eller spill av samtalen på høyttaler nær mikrofonen."
              : "Trykk på transkript-ikonet eller «Lytt» for å starte automatisk transkripsjon."}
          </p>
        ) : (
          <p className="whitespace-pre-wrap">
            {transcript}
            {interim ? (
              <span className="text-slate-400 italic"> {interim}</span>
            ) : null}
          </p>
        )}
      </div>

      {error ? (
        <p className="border-t border-white/10 px-4 py-2 text-xs text-amber-300">{error}</p>
      ) : null}
      {isListening ? (
        <p className="border-t border-white/10 px-4 py-2 text-[10px] text-slate-500">
          Opptak aktiv — teksten oppdateres mens du snakker. Fungerer best med høyttaler eller headset.
        </p>
      ) : null}
    </div>
  );
}
