"use client";

import { useState } from "react";
import { copy } from "../../copy/no";
import { FILTER_CHIPS, SAMPLE_COMPANIES, type SampleCompany } from "../../sample-data";
import type { ReactNode } from "react";

type LayoutVariant = "default" | "spreadsheet" | "sidebar" | "cards";

type Props = {
  themeClass: string;
  variant?: LayoutVariant;
  headerExtra?: ReactNode;
};

export function ScanLayout({ themeClass, variant = "default", headerExtra }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(["923456789"]));
  const [progress, setProgress] = useState(72);

  const toggle = (orgnr: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orgnr)) next.delete(orgnr);
      else next.add(orgnr);
      return next;
    });
  };

  return (
    <div
      className={themeClass}
      style={{
        minHeight: "100vh",
        background: "var(--ps-bg)",
        color: "var(--ps-text)",
        fontFamily: "var(--ps-font)",
      }}
    >
      <header
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          background: "var(--ps-header-bg)",
          borderBottom: "1px solid var(--ps-border)",
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 18 }}>
          <span>Ny</span>
          <span style={{ color: "var(--ps-accent)" }}>Lead</span>
        </span>
        <span style={{ fontSize: 13, color: "var(--ps-muted)" }}>Design-lab</span>
      </header>

      <main style={{ padding: variant === "sidebar" ? 0 : 24 }}>
        <div style={{ maxWidth: variant === "sidebar" ? "100%" : 1400, margin: "0 auto" }}>
          <div style={{ padding: variant === "sidebar" ? "24px 24px 0" : 0 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>{copy.scanTitle}</h1>
            <p style={{ margin: 0, color: "var(--ps-muted)", fontSize: 14 }}>{copy.scanSubtitle}</p>
            {headerExtra}
          </div>

          <div
            style={{
              display: variant === "sidebar" ? "grid" : "block",
              gridTemplateColumns: variant === "sidebar" ? "240px 1fr" : undefined,
              gap: variant === "sidebar" ? 0 : 16,
              marginTop: 20,
            }}
          >
            {variant === "sidebar" && (
              <aside
                style={{
                  background: "var(--ps-surface)",
                  borderRight: "1px solid var(--ps-border)",
                  padding: 20,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--ps-muted)", marginBottom: 12 }}>
                  Filtre
                </div>
                {["Område", "Kommune", "Bransje", "Periode"].map((label) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>
                    <div
                      style={{
                        padding: "8px 12px",
                        border: "1px solid var(--ps-border)",
                        borderRadius: "var(--ps-radius)",
                        fontSize: 13,
                      }}
                    >
                      {label === "Område" ? "Hele Norge" : label === "Periode" ? "30 dager" : "—"}
                    </div>
                  </div>
                ))}
              </aside>
            )}

            <div style={{ padding: variant === "sidebar" ? "0 24px 24px" : 0 }}>
              {variant !== "sidebar" && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 16,
                    padding: 16,
                    background: "var(--ps-surface)",
                    borderRadius: "var(--ps-radius)",
                    border: "1px solid var(--ps-border)",
                  }}
                >
                  {FILTER_CHIPS.map((chip) => (
                    <span
                      key={chip}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        borderRadius: "var(--ps-radius)",
                        border: "1px solid var(--ps-border)",
                        background: "var(--ps-chip-bg)",
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}

              <div
                style={{
                  padding: 16,
                  marginBottom: 16,
                  background: "var(--ps-scan-bg)",
                  borderRadius: "var(--ps-radius)",
                  border: "1px solid var(--ps-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                  <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" defaultChecked readOnly /> Facebook
                  </label>
                  <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" defaultChecked readOnly /> Instagram
                  </label>
                  <button
                    type="button"
                    style={{
                      marginLeft: "auto",
                      padding: "10px 20px",
                      background: "var(--ps-cta-bg)",
                      color: "var(--ps-cta-text)",
                      border: "none",
                      borderRadius: "var(--ps-radius)",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Start sjekk (1)
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "var(--ps-muted)", marginBottom: 6 }}>
                  Sjekker nettside… 7 av 10
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "var(--ps-border)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background: "var(--ps-accent)",
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>

              {variant === "cards" ? (
                <CompanyCards companies={SAMPLE_COMPANIES} selected={selected} onToggle={toggle} />
              ) : (
                <CompanyTable
                  companies={SAMPLE_COMPANIES}
                  selected={selected}
                  onToggle={toggle}
                  dense={variant === "spreadsheet"}
                />
              )}

              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--ps-surface)",
                  border: "1px solid var(--ps-border)",
                  borderRadius: "var(--ps-radius)",
                }}
              >
                <span style={{ fontSize: 14 }}>{selected.size} firma valgt</span>
                <button
                  type="button"
                  style={{
                    padding: "12px 24px",
                    background: "var(--ps-cta-bg)",
                    color: "var(--ps-cta-text)",
                    border: "none",
                    borderRadius: "var(--ps-radius)",
                    fontWeight: 700,
                  }}
                >
                  Send kampanje
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function CompanyTable({
  companies,
  selected,
  onToggle,
  dense,
}: {
  companies: SampleCompany[];
  selected: Set<string>;
  onToggle: (orgnr: string) => void;
  dense?: boolean;
}) {
  const cellPad = dense ? "8px 10px" : "12px 14px";
  const fontSize = dense ? 12 : 13;

  return (
    <div
      style={{
        overflow: "auto",
        border: "1px solid var(--ps-border)",
        borderRadius: "var(--ps-radius)",
        background: "var(--ps-surface)",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize }}>
        <thead>
          <tr style={{ background: "var(--ps-table-head)", textAlign: "left" }}>
            <th style={{ padding: cellPad, width: 36 }} />
            <th style={{ padding: cellPad }}>Firma</th>
            <th style={{ padding: cellPad }}>Org.nr</th>
            <th style={{ padding: cellPad }}>E-post</th>
            <th style={{ padding: cellPad }}>Tlf</th>
            <th style={{ padding: cellPad }}>Nettside</th>
            <th style={{ padding: cellPad }}>FB</th>
            <th style={{ padding: cellPad }}>IG</th>
            <th style={{ padding: cellPad }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.orgnr} style={{ borderTop: "1px solid var(--ps-border)" }}>
              <td style={{ padding: cellPad }}>
                <input
                  type="checkbox"
                  checked={selected.has(c.orgnr)}
                  onChange={() => onToggle(c.orgnr)}
                />
              </td>
              <td style={{ padding: cellPad, fontWeight: 600 }}>{c.name}</td>
              <td style={{ padding: cellPad, color: "var(--ps-muted)" }}>{c.orgnr}</td>
              <td style={{ padding: cellPad }}>{c.email ?? "—"}</td>
              <td style={{ padding: cellPad }}>{c.phone ?? "—"}</td>
              <td style={{ padding: cellPad }}>
                <WebsiteCell status={c.websiteStatus} label={c.website} />
              </td>
              <td style={{ padding: cellPad }}>{c.facebook ? "✓" : "—"}</td>
              <td style={{ padding: cellPad }}>{c.instagram ? "✓" : "—"}</td>
              <td style={{ padding: cellPad }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--ps-badge-bg)",
                  }}
                >
                  {c.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompanyCards({
  companies,
  selected,
  onToggle,
}: {
  companies: SampleCompany[];
  selected: Set<string>;
  onToggle: (orgnr: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
      {companies.map((c) => (
        <div
          key={c.orgnr}
          style={{
            padding: 16,
            border: "1px solid var(--ps-border)",
            borderRadius: "var(--ps-radius)",
            background: "var(--ps-surface)",
          }}
        >
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={selected.has(c.orgnr)}
              onChange={() => onToggle(c.orgnr)}
            />
            <div>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "var(--ps-muted)" }}>{c.municipality}</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>{c.website}</div>
            </div>
          </label>
        </div>
      ))}
    </div>
  );
}

function WebsiteCell({ status, label }: { status: SampleCompany["websiteStatus"]; label: string }) {
  const color =
    status === "none" ? "var(--ps-warn)" : status === "yes" ? "var(--ps-muted)" : "var(--ps-accent)";
  return <span style={{ color }}>{label}</span>;
}
