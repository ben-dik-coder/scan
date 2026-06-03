"use client";

import { useState } from "react";
import { SAMPLE_COMPANIES, type SampleCompany } from "../../sample-data";
import "./tokens.css";

const ACCENTS = ["var(--cv-accent)", "var(--cv-accent-2)", "var(--cv-accent-3)", "var(--cv-accent)"];

export function CompanyListPreview({ companies = SAMPLE_COMPANIES }: { companies?: SampleCompany[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div className="nylead-theme-card-grid" style={{ background: "var(--cv-bg)", padding: 16, fontFamily: "var(--cv-font)" }}>
      <label style={{ display: "flex", gap: 8, marginBottom: 12, fontSize: 13, color: "var(--cv-text)" }}>
        <input type="checkbox" checked={selected.size === companies.length} onChange={() => setSelected(selected.size === companies.length ? new Set() : new Set(companies.map((c) => c.orgnr)))} />
        Velg alle · {companies.length} firma
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {companies.map((c, i) => (
          <article
            key={c.orgnr}
            style={{
              background: "var(--cv-surface)",
              borderRadius: "var(--cv-radius)",
              border: `1px solid ${selected.has(c.orgnr) ? ACCENTS[i % 3] : "var(--cv-border)"}`,
              borderLeftWidth: 4,
              borderLeftColor: ACCENTS[i % 3],
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 12, display: "flex", gap: 8 }}>
              <input type="checkbox" checked={selected.has(c.orgnr)} onChange={() => toggle(selected, setSelected, c.orgnr)} />
              <div>
                <h3 style={{ margin: 0, fontSize: 14, color: "var(--cv-text)" }}>{c.name}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--cv-muted)", fontFamily: "var(--cv-font-mono)" }}>{c.orgnr}</p>
              </div>
            </div>
            <div style={{ padding: "8px 12px 12px", fontSize: 12, color: "var(--cv-muted)", borderTop: "1px solid var(--cv-border)" }}>
              <p style={{ margin: "0 0 4px" }}>{c.email ?? "Mangler e-post"}</p>
              <p style={{ margin: "0 0 4px" }}>{c.phone ?? "—"}</p>
              <p style={{ margin: 0, color: "var(--cv-link)", fontWeight: 500 }}>{c.website}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function toggle(selected: Set<string>, setSelected: (s: Set<string>) => void, orgnr: string) {
  const next = new Set(selected);
  if (next.has(orgnr)) next.delete(orgnr);
  else next.add(orgnr);
  setSelected(next);
}
