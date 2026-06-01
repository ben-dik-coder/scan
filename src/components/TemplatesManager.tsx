"use client";

import type { EmailTemplate } from "@/types/database";
import { useState } from "react";
import { PageHeader } from "@/components/ui/primitives";

export function TemplatesManager({
  templates,
  onAdd,
  onRemove,
}: {
  templates: EmailTemplate[];
  onAdd: (t: Omit<EmailTemplate, "id" | "user_id" | "created_at" | "updated_at">) => void;
  onRemove: (id: string) => void;
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
      />

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="panel p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-white">{t.name}</h3>
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
            <p className="mt-2 text-sm text-white/70">Emne: {t.subject}</p>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-white/50">
              {t.body}
            </pre>
          </div>
        ))}
      </div>

      <form onSubmit={createTemplate} className="panel space-y-4 p-5">
        <h2 className="font-display font-bold text-white">Ny mal</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Malnavn"
          required
          className="input-dark py-2"
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Emne — bruk {firmanavn}"
          required
          className="input-dark py-2"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Meldingstekst"
          rows={5}
          required
          className="input-dark py-2"
        />
        <button type="submit" className="btn-primary">
          Lagre mal
        </button>
      </form>
    </div>
  );
}
