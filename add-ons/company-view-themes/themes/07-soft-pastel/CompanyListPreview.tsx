"use client";

import { useState } from "react";
import { SAMPLE_COMPANIES, type SampleCompany } from "../../sample-data";
import "./tokens.css";

const PASTELS = ["#fce7f3", "#ede9fe", "#d1fae5", "#fef3c7"];

export function CompanyListPreview({ companies = SAMPLE_COMPANIES }: { companies?: SampleCompany[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div className="nylead-theme-soft-pastel" style={{ background: "var(--cv-bg)", padding: 20, fontFamily: "var(--cv-font)" }}>
      <div style={{ background: "var(--cv-surface)", borderRadius: "var(--cv-radius)", padding: "12px 16px", marginBottom: 16, border: "1px solid var(--cv-border)" }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--cv-text)", fontSize: 14 }}>
          <input type="checkbox" checked={selected.size === companies.length} onChange={() => setSelected(selected.size === companies.length ? new Set() : new Set(companies.map((c) => c.orgnr)))} />
          Velg alle søte firma
        </label>
      </div>
      {companies.map((c, i) => (
        <div
          key={c.orgnr}
          style={{
            background: PASTELS[i % PASTELS.length],
            borderRadius: "var(--cv-radius)",
            padding: 16,
            marginBottom: 12,
            border: selected.has(c.orgnr) ? "2px solid var(--cv-accent)" : "2px solid transparent",
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            <input type="checkbox" checked={selected.has(c.orgnr)} onChange={() => toggle(selected, setSelected, c.orgnr)} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--cv-text)" }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "var(--cv-muted)", marginTop: 2 }}>{c.orgnr}</div>
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--cv-text)", lineHeight: 1.7 }}>
                <div>{c.email ?? "Ingen e-post enda"}</div>
                <div>{c.phone ?? "Ingen telefon"}</div>
                <div style={{ color: "var(--cv-link)" }}>{c.website}</div>
              </div>
            </div>
          </div>
        </div>
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
