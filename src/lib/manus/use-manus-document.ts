"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyManus,
  loadLocalManus,
  saveLocalManus,
  type ManusDocument,
} from "@/lib/manus/manus-storage";
import { isDemoMode } from "@/lib/demo/config";

export type ManusSaveState = "idle" | "saving" | "saved" | "error";

export function useManusDocument(enabled = true) {
  const demo = isDemoMode();
  const [title, setTitle] = useState("Manus");
  const [bodyHtml, setBodyHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<ManusSaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const autoSaveTimer = useRef<number | null>(null);

  const persistLocal = useCallback((doc: ManusDocument) => {
    saveLocalManus(doc);
  }, []);

  const saveToServer = useCallback(
    async (doc: ManusDocument, options?: { silent?: boolean }) => {
      if (demo) {
        persistLocal(doc);
        setDirty(false);
        setSaveState("saved");
        return true;
      }

      if (!options?.silent) setSaveState("saving");
      setError(null);

      try {
        const res = await fetch("/api/manus", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: doc.title,
            bodyHtml: doc.bodyHtml,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Kunne ikke lagre manus");
        }

        const saved: ManusDocument = {
          title: data.title ?? doc.title,
          bodyHtml: data.bodyHtml ?? doc.bodyHtml,
          updatedAt: data.updatedAt ?? new Date().toISOString(),
        };
        persistLocal(saved);
        setTitle(saved.title);
        setBodyHtml(saved.bodyHtml);
        setDirty(false);
        setSaveState("saved");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Kunne ikke lagre";
        setError(message);
        setSaveState("error");
        return false;
      }
    },
    [demo, persistLocal]
  );

  const handleSave = useCallback(async () => {
    const doc: ManusDocument = {
      title,
      bodyHtml,
      updatedAt: new Date().toISOString(),
    };
    await saveToServer(doc);
  }, [bodyHtml, saveToServer, title]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveState("idle");
  }, []);

  const updateTitle = useCallback(
    (value: string) => {
      setTitle(value);
      markDirty();
    },
    [markDirty]
  );

  const updateBodyHtml = useCallback(
    (value: string) => {
      setBodyHtml(value);
      markDirty();
    },
    [markDirty]
  );

  const replaceDocument = useCallback(
    (doc: Pick<ManusDocument, "title" | "bodyHtml">) => {
      setTitle(doc.title);
      setBodyHtml(doc.bodyHtml);
      markDirty();
    },
    [markDirty]
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSaveState("idle");
      setDirty(false);

      const local = loadLocalManus();

      if (demo) {
        const doc = local ?? emptyManus();
        if (!cancelled) {
          setTitle(doc.title);
          setBodyHtml(doc.bodyHtml);
        }
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/manus");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Kunne ikke hente manus");

        const remote: ManusDocument = {
          title: data.title ?? "Manus",
          bodyHtml: data.bodyHtml ?? "",
          updatedAt: data.updatedAt ?? new Date(0).toISOString(),
        };

        const localTime = local ? Date.parse(local.updatedAt) : 0;
        const remoteTime = Date.parse(remote.updatedAt);
        const doc =
          local && localTime > remoteTime && local.bodyHtml !== remote.bodyHtml
            ? local
            : remote.bodyHtml || !local
              ? remote
              : local;

        if (!cancelled) {
          setTitle(doc.title);
          setBodyHtml(doc.bodyHtml);
          persistLocal(doc);
        }
      } catch (err) {
        const doc = local ?? emptyManus();
        if (!cancelled) {
          setTitle(doc.title);
          setBodyHtml(doc.bodyHtml);
          setError(
            err instanceof Error
              ? `${err.message} — viser lokal kopi.`
              : "Kunne ikke hente manus — viser lokal kopi."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, demo, persistLocal]);

  useEffect(() => {
    if (!enabled || !dirty) return;

    const doc: ManusDocument = {
      title,
      bodyHtml,
      updatedAt: new Date().toISOString(),
    };
    persistLocal(doc);

    if (autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = window.setTimeout(() => {
      void saveToServer(doc, { silent: true });
    }, 2000);

    return () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
      }
    };
  }, [enabled, dirty, title, bodyHtml, persistLocal, saveToServer]);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, handleSave]);

  return {
    title,
    bodyHtml,
    loading,
    saveState,
    error,
    dirty,
    setTitle: updateTitle,
    setBodyHtml: updateBodyHtml,
    replaceDocument,
    handleSave,
  };
}
