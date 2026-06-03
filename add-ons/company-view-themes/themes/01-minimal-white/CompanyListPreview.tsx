"use client";

import { useState } from "react";
import { SAMPLE_COMPANIES, type SampleCompany } from "../../sample-data";
import "./tokens.css";

export function CompanyListPreview({
  companies = SAMPLE_COMPANIES,
}: {
  companies?: SampleCompany[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div className="nylead-theme-minimal-white" style={wrap}>
      <header style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--cv-border)" }}>
        <label style={selectAll}>
          <input
            type="checkbox"
            checked={selected.size === companies.length}
            onChange={() =>
              setSelected(
                selected.size === companies.length
                  ? new Set()
                  : new Set(companies.map((c) => c.orgnr))
              )
            }
          />
          Velg alle
        </label>
        <span style={{ color: "var(--cv-muted)", fontSize: 13 }}>{companies.length} firma</span>
      </header>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {companies.map((c) => (
          <li
            key={c.orgnr}
            style={{
              display: "flex",
              gap: 16,
              padding: "20px 0",
              borderBottom: "1px solid var(--cv-border)",
              fontFamily: "var(--cv-font)",
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(c.orgnr)}
              onChange={() => toggle(selected, setSelected, c.orgnr)}
              style={{ marginTop: 4 }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "var(--cv-text)" }}>{c.name}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--cv-muted)", fontFamily: "var(--cv-font-mono)" }}>
                {c.orgnr}
              </p>
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: "8px 20px", fontSize: 13, color: "var(--cv-muted)" }}>
                <span>{c.email ?? "Mangler e-post"}</span>
                <span>{c.phone ?? "—"}</span>
                <span>{c.website}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const wrap: React.CSSProperties = {
  background: "var(--cv-bg)",
  color: "var(--cv-text)",
  padding: 24,
  minHeight: 320,
};

const selectAll: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  cursor: "pointer",
};

function toggle(
  selected: Set<string>,
  setSelected: (s: Set<string>) => void,
  orgnr: string
) {
  const next = new Set(selected);
  if (next.has(orgnr)) next.delete(orgnr);
  else next.add(orgnr);
  setSelected(next);
}
