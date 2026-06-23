"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearRingTranscript,
  loadRingTranscript,
  saveRingTranscript,
} from "@/lib/ring/ring-transcript-storage";
import {
  appendTranscriptChunk,
  fetchWhisperAvailability,
  isMediaRecordingSupported,
  pickRecorderMimeType,
  transcribeAudioBlob,
  type TranscriptEngine,
} from "@/lib/ring/transcribe-client";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
} from "@/lib/ring/speech-recognition";

const CHUNK_MS = 8_000;

export function useRingTranscript(orgnr: string | null) {
  const [supported] = useState(() => isMediaRecordingSupported());
  const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null);
  const [engine, setEngine] = useState<TranscriptEngine>("whisper");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const orgnrRef = useRef(orgnr);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition>>(null);
  const keepListeningRef = useRef(false);
  const engineRef = useRef<TranscriptEngine>("whisper");
  const queueRef = useRef<Blob[]>([]);
  const drainingRef = useRef(false);

  useEffect(() => {
    orgnrRef.current = orgnr;
  }, [orgnr]);

  useEffect(() => {
    void fetchWhisperAvailability().then(setWhisperAvailable);
  }, []);

  const persist = useCallback((text: string) => {
    const key = orgnrRef.current;
    if (key && text.trim()) {
      saveRingTranscript(key, text.trim());
    }
  }, []);

  const appendText = useCallback(
    (chunk: string) => {
      setTranscript((prev) => {
        const next = appendTranscriptChunk(prev, chunk);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    setIsProcessing(true);
    try {
      while (queueRef.current.length > 0) {
        const blob = queueRef.current.shift();
        if (!blob || blob.size < 1000) continue;
        try {
          const text = await transcribeAudioBlob(blob);
          if (text) appendText(text);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Kunne ikke transkribere lyd";
          setError(message);
          break;
        }
      }
    } finally {
      drainingRef.current = false;
      setIsProcessing(false);
    }
  }, [appendText]);

  const stopBrowserRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  }, []);

  const startBrowserRecognition = useCallback(() => {
    if (!isSpeechRecognitionSupported()) return false;
    const recognition = createSpeechRecognition();
    if (!recognition) return false;
    recognition.lang = "no-NO";
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalChunk += piece;
        else interimChunk += piece;
      }
      if (finalChunk) appendText(finalChunk);
      setInterim(interimChunk.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      if (event.error === "not-allowed") {
        setError("Mikrofontilgang ble nektet.");
      } else {
        setError(event.message ?? `Talegjenkjenning feilet (${event.error})`);
      }
    };

    recognition.onend = () => {
      if (!keepListeningRef.current || engineRef.current !== "browser") return;
      try {
        recognition.start();
      } catch {
        /* ignore */
      }
    };

    try {
      recognition.start();
      return true;
    } catch {
      return false;
    }
  }, [appendText]);

  const stop = useCallback(() => {
    keepListeningRef.current = false;
    setIsListening(false);
    setInterim("");

    stopBrowserRecognition();

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;

    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamRef.current = null;
  }, [stopBrowserRecognition]);

  const start = useCallback(async () => {
    if (!supported) {
      setError("Opptak støttes ikke i denne nettleseren.");
      return false;
    }

    setError(null);
    stop();

    let useWhisper = whisperAvailable !== false;
    if (whisperAvailable === null) {
      useWhisper = await fetchWhisperAvailability();
      setWhisperAvailable(useWhisper);
    }

    const nextEngine: TranscriptEngine = useWhisper ? "whisper" : "browser";
    if (nextEngine === "browser" && !isSpeechRecognitionSupported()) {
      setError(
        "AI-transkripsjon er ikke tilgjengelig, og nettleseren støtter ikke talegjenkjenning."
      );
      return false;
    }

    engineRef.current = nextEngine;
    setEngine(nextEngine);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setError("Kunne ikke få tilgang til mikrofon. Sjekk tillatelser.");
      return false;
    }

    streamRef.current = stream;
    keepListeningRef.current = true;
    setIsListening(true);

    if (nextEngine === "browser") {
      if (!startBrowserRecognition()) {
        stop();
        setError("Kunne ikke starte talegjenkjenning i nettleseren.");
        return false;
      }
      return true;
    }

    const mimeType = pickRecorderMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (!event.data || event.data.size < 1000) return;
      queueRef.current.push(event.data);
      void drainQueue();
    };

    recorder.onerror = () => {
      setError("Lydopptak feilet.");
      stop();
    };

    recorder.start(CHUNK_MS);
    return true;
  }, [drainQueue, startBrowserRecognition, stop, supported, whisperAvailable]);

  const toggle = useCallback((): boolean => {
    if (isListening) {
      stop();
      return false;
    }
    void start();
    return true;
  }, [isListening, start, stop]);

  const clear = useCallback(() => {
    setTranscript("");
    setInterim("");
    if (orgnr) clearRingTranscript(orgnr);
  }, [orgnr]);

  const updateTranscript = useCallback(
    (value: string) => {
      setTranscript(value);
      persist(value);
    },
    [persist]
  );

  useEffect(() => {
    stop();
    queueRef.current = [];
    setTranscript(orgnr ? loadRingTranscript(orgnr) : "");
    setInterim("");
    setError(null);
  }, [orgnr, stop]);

  useEffect(() => () => stop(), [stop]);

  const displayText = [transcript, interim, isProcessing ? "…" : ""]
    .filter(Boolean)
    .join(transcript && interim ? " " : "");

  return {
    supported,
    whisperAvailable,
    engine,
    isListening,
    isProcessing,
    transcript,
    interim,
    displayText,
    error,
    start,
    stop,
    toggle,
    clear,
    updateTranscript,
  };
}
