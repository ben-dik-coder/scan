"use client";

import { useState } from "react";
import { SAMPLE_COMPANIES, type SampleCompany } from "../../sample-data";
import "./tokens.css";

export function CompanyListPreview({ companies = SAMPLE_COMPANIES }: { companies?: SampleCompany[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div className="nylead-theme-nordic-nature" style={{ background: "var(--cv-bg)", padding: 16, fontFamily: "var(--cv-font)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ width: 4, height: 24, background: "var(--cv-accent)", borderRadius: 2 }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cv-text)" }}>Firma i markedet</div>
          <div style={{ fontSize: 12, color: "var(--cv-muted)" }}>{companies.length} funnet</div>
        </div>
      </div>
      <label style={{ display: "flex", gap: 8, marginBottom: 12, fontSize: 13, color: "var(--cv-accent)" }}>
        <input type="checkbox" checked={selected.size === companies.length} onChange={() => setSelected(selected.size === companies.length ? new Set() : new Set(companies.map((c) => c.orgnr)))} />
        Velg alle
      </label>
      {companies.map((c) => (
        <div
          key={c.orgnr}
          style={{
            display: "flex",
            gap: 12,
            padding: 14,
            marginBottom: 10,
            background: "var(--cv-surface)",
            borderRadius: "var(--cv-radius)",
            border: `1px solid ${selected.has(c.orgnr) ? "var(--cv-accent)" : "var(--cv-border)"}`,
          }}
        >
          <input type="checkbox" checked={selected.has(c.orgnr)} onChange={() => toggle(selected, setSelected, c.orgnr)} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, color: "var(--cv-text)" }}>{c.name}</span>
              <span style={{ fontSize: 11, color: "var(--cv-accent-2)" }}>{c.municipality}</span>
            </div>
            <div style={{ fontSize: 11, fontFamily: "var(--cv-font-mono)", color: "var(--cv-muted)", marginTop: 4 }}>{c.orgnr}</div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, padding: "4px 8px", background: "#e8f0e6", borderRadius: 6, color: "var(--cv-text)" }}>{c.email ?? "Mangler"}</span>
              <span style={{ fontSize: 12, padding: "4px 8px", background: "#f0ebe3", borderRadius: 6, color: "var(--cv-text)" }}>{c.phone ?? "—"}</span>
              <span style={{ fontSize: 12, padding: "4px 8px", background: "#dce8df", borderRadius: 6, color: "var(--cv-link)", fontWeight: 500 }}>{c.website}</span>
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
