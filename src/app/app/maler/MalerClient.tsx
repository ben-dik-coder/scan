"use client";

import { useEffect, useState } from "react";
import { TemplatesManager } from "@/components/TemplatesManager";
import { useDemo } from "@/lib/demo/store";
import type { EmailTemplate } from "@/types/database";

type Props = {
  initialTemplates: EmailTemplate[];
  isDemo: boolean;
};

export function MalerClient({ initialTemplates, isDemo }: Props) {
  const demo = useDemo();
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDemo) return;
    setTemplates(demo.templates);
  }, [isDemo, demo.templates]);

  async function addTemplate(
    t: Omit<EmailTemplate, "id" | "user_id" | "created_at" | "updated_at">
  ) {
    if (isDemo) {
      demo.addTemplate(t);
      return;
    }

    setError(null);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Kunne ikke lagre mal");
      return;
    }
    setTemplates((prev) => [data, ...prev]);
  }

  async function removeTemplate(id: string) {
    if (isDemo) {
      demo.removeTemplate(id);
      return;
    }

    setError(null);
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Kunne ikke slette mal");
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  async function refresh() {
    if (isDemo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke hente maler");
      if (Array.isArray(data)) setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <TemplatesManager
      templates={templates}
      loading={loading}
      error={error}
      onAdd={addTemplate}
      onRemove={removeTemplate}
      onRefresh={isDemo ? undefined : refresh}
    />
  );
}
