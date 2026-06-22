"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppSideDrawer } from "@/components/ui/AppSideDrawer";
import { RichTextEditor } from "@/components/manus/RichTextEditor";
import {
  emptyManus,
  loadLocalManus,
  saveLocalManus,
  type ManusDocument,
} from "@/lib/manus/manus-storage";
import { isDemoMode } from "@/lib/demo/config";
import { cn } from "@/lib/utils";
import { Check, Loader2, Save } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function ManusSheet({ open, onClose }: Props) {
  const demo = isDemoMode();
  const [title, setTitle] = useState("Manus");
  const [bodyHtml, setBodyHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const autoSaveTimer = useRef<number | null>(null);
  const lastSavedRef = useRef<string>("");

  const persistLocal = useCallback((doc: ManusDocument) => {
    saveLocalManus(doc);
  }, []);

  const saveToServer = useCallback(
    async (doc: ManusDocument, options?: { silent?: boolean }) => {
      if (demo) {
        persistLocal(doc);
        setDirty(false);
        setSaveState("saved");
        lastSavedRef.current = doc.updatedAt;
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
        lastSavedRef.current = saved.updatedAt;
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

  useEffect(() => {
    if (!open) return;

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
          lastSavedRef.current = doc.updatedAt;
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
          lastSavedRef.current = doc.updatedAt;
          persistLocal(doc);
        }
      } catch (err) {
        const doc = local ?? emptyManus();
        if (!cancelled) {
          setTitle(doc.title);
          setBodyHtml(doc.bodyHtml);
          lastSavedRef.current = doc.updatedAt;
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
  }, [open, demo, persistLocal]);

  useEffect(() => {
    if (!open || !dirty) return;

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
    }, 2500);

    return () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
      }
    };
  }, [open, dirty, title, bodyHtml, persistLocal, saveToServer]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleSave]);

  function handleClose() {
    if (dirty) {
      const doc: ManusDocument = {
        title,
        bodyHtml,
        updatedAt: new Date().toISOString(),
      };
      persistLocal(doc);
      void saveToServer(doc, { silent: true });
    }
    onClose();
  }

  const statusLabel =
    saveState === "saving"
      ? "Lagrer…"
      : saveState === "saved" && !dirty
        ? "Lagret"
        : dirty
          ? "Ulagrede endringer"
          : null;

  return (
    <AppSideDrawer
      open={open}
      onClose={handleClose}
      fullScreenMobile
      maxWidth="xl"
      panelClassName="scan-glass-mobile-drawer bg-[#1c1c1e]/95"
      title={
        <div className="space-y-1 pr-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Innhold
          </p>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
              setSaveState("idle");
            }}
            maxLength={120}
            className="w-full bg-transparent text-lg font-semibold text-white outline-none placeholder:text-slate-500"
            placeholder="Tittel på manus"
            aria-label="Tittel på manus"
          />
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 text-xs text-slate-400">
            {statusLabel ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  saveState === "saved" && !dirty && "text-emerald-400",
                  saveState === "error" && "text-amber-300"
                )}
              >
                {saveState === "saved" && !dirty ? (
                  <Check className="h-3.5 w-3.5" />
                ) : saveState === "saving" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {statusLabel}
              </span>
            ) : (
              <span>Cmd+S / Ctrl+S for å lagre</span>
            )}
            {error ? (
              <p className="mt-1 text-amber-300">{error}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saveState === "saving"}
            className="scan-btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saveState === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lagre
          </button>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col p-4">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Henter manus…
          </div>
        ) : (
          <RichTextEditor
            html={bodyHtml}
            disabled={loading}
            placeholder="Skriv innledning, spørsmål, innvendinger og avslutning…"
            onChange={(next) => {
              setBodyHtml(next);
              setDirty(true);
              setSaveState("idle");
            }}
          />
        )}
      </div>
    </AppSideDrawer>
  );
}
