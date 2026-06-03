"use client";

import { useState } from "react";
import { SAMPLE_COMPANIES, type SampleCompany } from "../../sample-data";
import "./tokens.css";

export function CompanyListPreview({ companies = SAMPLE_COMPANIES }: { companies?: SampleCompany[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div className="nylead-theme-compact-table" style={{ background: "var(--cv-bg)", fontFamily: "var(--cv-font)", fontSize: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--cv-surface)", height: "var(--cv-row-height)" }}>
            <th style={th}>
              <input type="checkbox" checked={selected.size === companies.length} onChange={() => setSelected(selected.size === companies.length ? new Set() : new Set(companies.map((c) => c.orgnr)))} />
            </th>
            <th style={th}>Firma</th>
            <th style={th}>Org.nr</th>
            <th style={th}>E-post</th>
            <th style={th}>Tlf</th>
            <th style={th}>Nettside</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.orgnr} style={{ height: "var(--cv-row-height)", borderBottom: "1px solid var(--cv-border)", background: selected.has(c.orgnr) ? "var(--cv-surface)" : undefined }}>
              <td style={td}>
                <input type="checkbox" checked={selected.has(c.orgnr)} onChange={() => toggle(selected, setSelected, c.orgnr)} />
              </td>
              <td style={{ ...td, fontWeight: 600, color: "var(--cv-text)" }}>{c.name}</td>
              <td style={{ ...td, fontFamily: "var(--cv-font-mono)", fontSize: 11, color: "var(--cv-muted)" }}>{c.orgnr}</td>
              <td style={td}>{c.email ?? "—"}</td>
              <td style={td}>{c.phone ?? "—"}</td>
              <td style={{ ...td, color: "var(--cv-accent)" }}>{c.website}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "4px 8px", color: "var(--cv-muted)", fontWeight: 600, fontSize: 11 };
const td: React.CSSProperties = { padding: "4px 8px", color: "var(--cv-text)" };

function toggle(selected: Set<string>, setSelected: (s: Set<string>) => void, orgnr: string) {
  const next = new Set(selected);
  if (next.has(orgnr)) next.delete(orgnr);
  else next.add(orgnr);
  setSelected(next);
}
