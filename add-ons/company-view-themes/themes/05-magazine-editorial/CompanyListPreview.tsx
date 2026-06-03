"use client";

import { useState } from "react";
import { SAMPLE_COMPANIES, type SampleCompany } from "../../sample-data";
import "./tokens.css";

export function CompanyListPreview({ companies = SAMPLE_COMPANIES }: { companies?: SampleCompany[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div className="nylead-theme-magazine-editorial" style={{ background: "var(--cv-bg)", padding: 20, fontFamily: "var(--cv-font)" }}>
      <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--cv-muted)", margin: "0 0 8px" }}>
        Firmaliste
      </p>
      <h2 style={{ margin: "0 0 20px", fontSize: 28, fontWeight: 400, color: "var(--cv-text)", borderBottom: "2px solid var(--cv-accent)", paddingBottom: 8 }}>
        {companies.length} nye leads
      </h2>
      <label style={{ display: "flex", gap: 8, marginBottom: 16, fontSize: 13, fontStyle: "italic", color: "var(--cv-muted)" }}>
        <input type="checkbox" checked={selected.size === companies.length} onChange={() => setSelected(selected.size === companies.length ? new Set() : new Set(companies.map((c) => c.orgnr)))} />
        Velg alle
      </label>
      {companies.map((c, i) => (
        <article key={c.orgnr} style={{ marginBottom: i < companies.length - 1 ? 28 : 0, paddingBottom: 20, borderBottom: i < companies.length - 1 ? "1px solid var(--cv-border)" : undefined }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <input type="checkbox" checked={selected.has(c.orgnr)} onChange={() => toggle(selected, setSelected, c.orgnr)} style={{ marginTop: 8 }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 400, color: "var(--cv-text)", lineHeight: 1.2 }}>{c.name}</h3>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--cv-muted)", fontFamily: "var(--cv-font-mono)" }}>{c.orgnr} · {c.municipality}</p>
              <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.6, color: "var(--cv-text)" }}>
                {c.email ? <a href={`mailto:${c.email}`} style={{ color: "var(--cv-link)" }}>{c.email}</a> : "Ingen e-post"}
                {c.phone ? ` · ${c.phone}` : ""}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--cv-accent)", fontWeight: 600 }}>{c.website}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function toggle(selected: Set<string>, setSelected: (s: Set<string>) => void, orgnr: string) {
  const next = new Set(selected);
  if (next.has(orgnr)) next.delete(orgnr);
  else next.add(orgnr);
  setSelected(next);
}
