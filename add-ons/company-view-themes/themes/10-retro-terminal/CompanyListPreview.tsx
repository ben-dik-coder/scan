"use client";

import { useState } from "react";
import { SAMPLE_COMPANIES, type SampleCompany } from "../../sample-data";
import "./tokens.css";

export function CompanyListPreview({ companies = SAMPLE_COMPANIES }: { companies?: SampleCompany[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div
      className="nylead-theme-retro-terminal"
      style={{
        background: "var(--cv-bg)",
        padding: 16,
        fontFamily: "var(--cv-font)",
        color: "var(--cv-text)",
        border: "1px solid var(--cv-border)",
      }}
    >
      <pre style={{ margin: "0 0 12px", fontSize: 11, color: "var(--cv-muted)" }}>
        {`> nylead scan --list\n> ${companies.length} records loaded`}
      </pre>
      <label style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={selected.size === companies.length} onChange={() => setSelected(selected.size === companies.length ? new Set() : new Set(companies.map((c) => c.orgnr)))} />
        [SELECT_ALL]
      </label>
      {companies.map((c, i) => (
        <div key={c.orgnr} style={{ marginBottom: 8, padding: 8, border: "1px dashed var(--cv-border)", background: selected.has(c.orgnr) ? "var(--cv-surface)" : undefined }}>
          <div style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.6 }}>
            <input type="checkbox" checked={selected.has(c.orgnr)} onChange={() => toggle(selected, setSelected, c.orgnr)} />
            <div style={{ flex: 1, fontFamily: "var(--cv-font-mono)" }}>
              <div>
                <span style={{ color: "var(--cv-muted)" }}>[{String(i + 1).padStart(2, "0")}]</span> {c.name}
              </div>
              <div style={{ color: "var(--cv-muted)" }}>ORG={c.orgnr}</div>
              <div>MAIL={c.email ?? "NULL"}</div>
              <div>TEL={c.phone ?? "NULL"}</div>
              <div style={{ color: "var(--cv-accent)" }}>WEB_STATUS={c.website.replace(/\s/g, "_").toUpperCase()}</div>
            </div>
          </div>
        </div>
      ))}
      <pre style={{ margin: "12px 0 0", fontSize: 11, color: "var(--cv-muted)" }}>{"> _"}</pre>
    </div>
  );
}

function toggle(selected: Set<string>, setSelected: (s: Set<string>) => void, orgnr: string) {
  const next = new Set(selected);
  if (next.has(orgnr)) next.delete(orgnr);
  else next.add(orgnr);
  setSelected(next);
}
