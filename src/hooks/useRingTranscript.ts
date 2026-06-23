"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearRingTranscript,
  loadRingTranscript,
  saveRingTranscript,
} from "@/lib/ring/ring-transcript-storage";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
} from "@/lib/ring/speech-recognition";

export function useRingTranscript(orgnr: string | null) {
  const [supported] = useState(() => isSpeechRecognitionSupported());
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition>>(null);
  const keepListeningRef = useRef(false);
  const orgnrRef = useRef(orgnr);

  useEffect(() => {
    orgnrRef.current = orgnr;
  }, [orgnr]);

  const stop = useCallback(() => {
    keepListeningRef.current = false;
    setIsListening(false);
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
    setInterim("");
  }, []);

  const persist = useCallback((text: string) => {
    const key = orgnrRef.current;
    if (key && text.trim()) {
      saveRingTranscript(key, text.trim());
    }
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setError("Transkripsjon støttes ikke i denne nettleseren. Prøv Chrome på Mac/PC.");
      return false;
    }

    setError(null);
    stop();

    const recognition = createSpeechRecognition();
    if (!recognition) {
      setError("Kunne ikke starte talegjenkjenning.");
      return false;
    }

    recognitionRef.current = recognition;
    keepListeningRef.current = true;
    setIsListening(true);

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          finalChunk += piece;
        } else {
          interimChunk += piece;
        }
      }

      if (finalChunk) {
        setTranscript((prev) => {
          const next = `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${finalChunk.trim()}`.trim();
          persist(next);
          return next;
        });
      }
      setInterim(interimChunk.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      if (event.error === "not-allowed") {
        setError("Mikrofontilgang ble nektet. Tillat mikrofon i nettleseren.");
      } else {
        setError(event.message ?? `Talegjenkjenning feilet (${event.error})`);
      }
      stop();
    };

    recognition.onend = () => {
      if (!keepListeningRef.current) return;
      try {
        recognition.start();
      } catch {
        keepListeningRef.current = false;
        setIsListening(false);
      }
    };

    try {
      recognition.start();
      return true;
    } catch {
      setError("Kunne ikke starte opptak. Sjekk at mikrofon er tilgjengelig.");
      stop();
      return false;
    }
  }, [persist, stop, supported]);

  const toggle = useCallback((): boolean => {
    if (isListening) {
      stop();
      return false;
    }
    return start();
  }, [isListening, start, stop]);

  const clear = useCallback(() => {
    setTranscript("");
    setInterim("");
    if (orgnr) clearRingTranscript(orgnr);
  }, [orgnr]);

  useEffect(() => {
    stop();
    setTranscript(orgnr ? loadRingTranscript(orgnr) : "");
    setInterim("");
    setError(null);
  }, [orgnr, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const displayText = [transcript, interim].filter(Boolean).join(transcript && interim ? " " : "");

  return {
    supported,
    isListening,
    transcript,
    interim,
    displayText,
    error,
    start,
    stop,
    toggle,
    clear,
  };
}
