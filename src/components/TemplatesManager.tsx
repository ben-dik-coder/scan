"use client";

import type { EmailTemplate } from "@/types/database";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

export function TemplatesManager({
  templates,
  onAdd,
  onRemove,
  loading = false,
  error = null,
  onRefresh,
}: {
  templates: EmailTemplate[];
  onAdd: (t: Omit<EmailTemplate, "id" | "user_id" | "created_at" | "updated_at">) => void;
  onRemove: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    onAdd({ name, subject, body, is_default: false });
    setName("");
    setSubject("");
    setBody("");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="E-postmaler"
        description="Lagre og gjenbruk meldinger"
        action={
          onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {loading ? "Laster…" : "Oppdater"}
            </button>
          ) : undefined
        }
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="scan-surface-full overflow-hidden">
        <div className="scan-glass-header flex items-start gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="scan-glass-strong text-base font-semibold">Hva er maler?</h2>
            <p className="scan-glass-muted mt-1 text-sm">
              Ferdige tekster du bruker når du sender fra Skann eller arbeidskøen. Velg en mal der —
              eller lag din egen her. Bytt ut{" "}
              <code className="text-sky-200">[ditt navn]</code> og lignende.{" "}
              <code className="text-sky-200">{"{firmanavn}"}</code> fylles inn automatisk.
            </p>
            <Link
              href="/app"
              className="scan-btn-primary mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              Gå til Skann og bruk en mal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {templates.length === 0 && !loading && (
        <p className="scan-glass-muted text-sm">
          Ingen maler ennå. Standardmaler legges inn automatisk første gang — eller lag en ny
          under.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="panel p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-brand-navy">{t.name}</h3>
                {t.is_default && (
                  <span className="text-xs font-semibold text-brand-gold">Standard</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(t.id)}
                className="text-xs text-red-400 transition hover:text-red-300"
              >
                Slett
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">Emne: {t.subject}</p>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-slate-500">
              {t.body}
            </pre>
          </div>
        ))}
      </div>

      <form onSubmit={createTemplate} className="panel space-y-4 p-5">
        <h2 className="font-display font-bold text-brand-navy">Ny mal</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Malnavn"
          required
          className="input-app py-2"
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Emne — bruk {firmanavn}"
          required
          className="input-app py-2"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Meldingstekst"
          rows={5}
          required
          className="input-app py-2"
        />
        <button type="submit" className="btn-primary">
          Lagre mal
        </button>
      </form>
    </div>
  );
}
