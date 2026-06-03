"use client";

import { useState } from "react";
import { SAMPLE_COMPANIES, type SampleCompany } from "../../sample-data";
import "./tokens.css";

export function CompanyListPreview({ companies = SAMPLE_COMPANIES }: { companies?: SampleCompany[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div className="nylead-theme-brutalist" style={{ background: "var(--cv-bg)", padding: 0, fontFamily: "var(--cv-font)", border: "4px solid var(--cv-border)" }}>
      <div style={{ background: "var(--cv-text)", color: "var(--cv-bg)", padding: "8px 12px", fontSize: 14, fontWeight: 900, textTransform: "uppercase" }}>
        FIRMA · {companies.length}
      </div>
      <label style={{ display: "flex", gap: 8, padding: 12, borderBottom: "4px solid var(--cv-border)", background: "var(--cv-surface)", fontWeight: 900, textTransform: "uppercase", fontSize: 12 }}>
        <input type="checkbox" checked={selected.size === companies.length} onChange={() => setSelected(selected.size === companies.length ? new Set() : new Set(companies.map((c) => c.orgnr)))} />
        VELG ALLE
      </label>
      {companies.map((c) => (
        <div
          key={c.orgnr}
          style={{
            padding: 12,
            borderBottom: "4px solid var(--cv-border)",
            background: selected.has(c.orgnr) ? "var(--cv-accent)" : "var(--cv-surface)",
            color: selected.has(c.orgnr) ? "#fff" : "var(--cv-text)",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input type="checkbox" checked={selected.has(c.orgnr)} onChange={() => toggle(selected, setSelected, c.orgnr)} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, textTransform: "uppercase" }}>{c.name}</div>
              <div style={{ fontFamily: "var(--cv-font-mono)", fontSize: 11, marginTop: 4 }}>{c.orgnr}</div>
              <div style={{ marginTop: 8, fontSize: 12, fontFamily: "var(--cv-font-mono)", lineHeight: 1.5 }}>
                <div>{c.email ?? "MANGLER"}</div>
                <div>{c.phone ?? "—"}</div>
                <div style={{ fontWeight: 900 }}>{c.website.toUpperCase()}</div>
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
