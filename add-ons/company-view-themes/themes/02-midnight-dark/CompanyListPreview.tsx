"use client";

import { useState } from "react";
import { SAMPLE_COMPANIES, type SampleCompany } from "../../sample-data";
import "./tokens.css";

export function CompanyListPreview({ companies = SAMPLE_COMPANIES }: { companies?: SampleCompany[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div className="nylead-theme-midnight-dark" style={{ background: "var(--cv-bg)", padding: 16, borderRadius: "var(--cv-radius)", fontFamily: "var(--cv-font)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 12, color: "var(--cv-muted)" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={selected.size === companies.length} onChange={() => setSelected(selected.size === companies.length ? new Set() : new Set(companies.map((c) => c.orgnr)))} />
          Velg alle
        </label>
        <span>{companies.length} firma</span>
      </div>
      {companies.map((c) => (
        <div
          key={c.orgnr}
          style={{
            background: selected.has(c.orgnr) ? "var(--cv-surface)" : "transparent",
            border: `1px solid ${selected.has(c.orgnr) ? "var(--cv-accent)" : "var(--cv-border)"}`,
            borderRadius: "var(--cv-radius)",
            padding: 12,
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" checked={selected.has(c.orgnr)} onChange={() => toggle(selected, setSelected, c.orgnr)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "var(--cv-text)", fontWeight: 600, fontSize: 14 }}>{c.name}</div>
              <div style={{ color: "var(--cv-muted)", fontSize: 11, fontFamily: "var(--cv-font-mono)", marginTop: 2 }}>{c.orgnr}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 8, fontSize: 12 }}>
                <span style={{ color: "var(--cv-muted)" }}>E-post</span>
                <span style={{ color: c.email ? "var(--cv-link)" : "var(--cv-muted)", textAlign: "right" }}>{c.email ?? "Mangler"}</span>
                <span style={{ color: "var(--cv-muted)" }}>Tlf</span>
                <span style={{ color: "var(--cv-text)", textAlign: "right" }}>{c.phone ?? "—"}</span>
                <span style={{ color: "var(--cv-muted)" }}>Web</span>
                <span style={{ color: "var(--cv-accent)", textAlign: "right" }}>{c.website}</span>
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
