"use client";

import { useState } from "react";
import { SAMPLE_COMPANIES, type SampleCompany } from "../../sample-data";
import "./tokens.css";

export function CompanyListPreview({ companies = SAMPLE_COMPANIES }: { companies?: SampleCompany[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div className="nylead-theme-corporate-blue" style={{ background: "var(--cv-bg)", fontFamily: "var(--cv-font)", borderRadius: "var(--cv-radius)", overflow: "hidden", border: "1px solid var(--cv-border)" }}>
      <div style={{ background: "var(--cv-header)", color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Firmaliste</span>
        <span style={{ fontSize: 12, opacity: 0.9 }}>{companies.length} poster</span>
      </div>
      <div style={{ background: "var(--cv-surface)", padding: "8px 16px", borderBottom: "1px solid var(--cv-border)" }}>
        <label style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--cv-text)" }}>
          <input type="checkbox" checked={selected.size === companies.length} onChange={() => setSelected(selected.size === companies.length ? new Set() : new Set(companies.map((c) => c.orgnr)))} />
          Velg alle synlige
        </label>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--cv-surface)" }}>
        <thead>
          <tr style={{ background: "#dbeafe", fontSize: 11, color: "var(--cv-header)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ width: 32, padding: 8 }} />
            <th style={{ textAlign: "left", padding: 8 }}>Firmanavn</th>
            <th style={{ textAlign: "left", padding: 8 }}>Org.nr</th>
            <th style={{ textAlign: "left", padding: 8 }}>Kontakt</th>
            <th style={{ textAlign: "left", padding: 8 }}>Status web</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.orgnr} style={{ borderTop: "1px solid var(--cv-border)", background: selected.has(c.orgnr) ? "#eff6ff" : undefined }}>
              <td style={{ padding: 10 }}>
                <input type="checkbox" checked={selected.has(c.orgnr)} onChange={() => toggle(selected, setSelected, c.orgnr)} />
              </td>
              <td style={{ padding: 10, fontWeight: 600, color: "var(--cv-text)", fontSize: 13 }}>{c.name}</td>
              <td style={{ padding: 10, fontFamily: "var(--cv-font-mono)", fontSize: 11, color: "var(--cv-muted)" }}>{c.orgnr}</td>
              <td style={{ padding: 10, fontSize: 12, color: "var(--cv-text)" }}>
                <div>{c.email ?? "—"}</div>
                <div style={{ color: "var(--cv-muted)" }}>{c.phone ?? "—"}</div>
              </td>
              <td style={{ padding: 10, fontSize: 12, color: "var(--cv-link)", fontWeight: 500 }}>{c.website}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toggle(selected: Set<string>, setSelected: (s: Set<string>) => void, orgnr: string) {
  const next = new Set(selected);
  if (next.has(orgnr)) next.delete(orgnr);
  else next.add(orgnr);
  setSelected(next);
}
