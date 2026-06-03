"use client";

import { copy } from "../../copy/no";
import type { ReactNode } from "react";

type Props = {
  themeClass: string;
  children?: ReactNode;
  heroExtra?: ReactNode;
  productMock?: ReactNode;
  variant?: "dark" | "light" | "gradient";
};

export function LandingLayout({
  themeClass,
  children,
  heroExtra,
  productMock,
  variant = "light",
}: Props) {
  const isDark = variant === "dark" || variant === "gradient";

  return (
    <div
      className={themeClass}
      style={{
        minHeight: "100vh",
        background: "var(--pl-bg)",
        color: "var(--pl-text)",
        fontFamily: "var(--pl-font)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          borderBottom: "1px solid var(--pl-border)",
          background: "var(--pl-surface)",
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          <span style={{ color: "var(--pl-text)" }}>Ny</span>
          <span style={{ color: "var(--pl-accent)" }}>Lead</span>
        </span>
        <nav style={{ display: "flex", gap: 24, fontSize: 14, color: "var(--pl-muted)" }}>
          <span>Funksjoner</span>
          <span>Slik fungerer det</span>
          <span>Pris</span>
        </nav>
      </header>

      <div
        style={{
          padding: "8px 32px",
          background: "var(--pl-banner-bg)",
          color: "var(--pl-banner-text)",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        {copy.seatsBanner}
      </div>

      <section
        style={{
          padding: "64px 32px",
          background: variant === "gradient" ? "var(--pl-hero-bg)" : "var(--pl-bg)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
          <div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--pl-accent)",
                marginBottom: 16,
              }}
            >
              {copy.audience}
            </p>
            <h1
              style={{
                fontSize: 48,
                fontWeight: 800,
                lineHeight: 1.1,
                margin: "0 0 20px",
                color: isDark ? "var(--pl-text)" : "var(--pl-text)",
              }}
            >
              {copy.heroTitle}
            </h1>
            <p style={{ fontSize: 18, color: "var(--pl-muted)", marginBottom: 32, lineHeight: 1.5 }}>
              {copy.heroSubtitle}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  padding: "14px 28px",
                  background: "var(--pl-cta-bg)",
                  color: "var(--pl-cta-text)",
                  border: "none",
                  borderRadius: "var(--pl-radius)",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "default",
                }}
              >
                {copy.ctaPrimary}
              </button>
              <button
                type="button"
                style={{
                  padding: "14px 28px",
                  background: "transparent",
                  color: "var(--pl-text)",
                  border: "1px solid var(--pl-border)",
                  borderRadius: "var(--pl-radius)",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "default",
                }}
              >
                {copy.ctaSecondary}
              </button>
            </div>
            <div style={{ display: "flex", gap: 32, marginTop: 40 }}>
              {copy.stats.map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--pl-accent)" }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "var(--pl-muted)" }}>{s.label}</div>
                </div>
              ))}
            </div>
            {heroExtra}
          </div>
          <div>{productMock ?? <DefaultProductMock isDark={isDark} />}</div>
        </div>
      </section>

      <section style={{ padding: "64px 32px", background: "var(--pl-surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 32 }}>Funksjoner</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
            {copy.features.map((f) => (
              <div
                key={f.title}
                style={{
                  padding: 24,
                  borderRadius: "var(--pl-radius)",
                  border: "1px solid var(--pl-border)",
                  background: "var(--pl-card-bg)",
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: "var(--pl-muted)" }}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "64px 32px", textAlign: "center" }}>
        <div
          style={{
            maxWidth: 400,
            margin: "0 auto",
            padding: 40,
            borderRadius: "var(--pl-radius-lg)",
            border: "2px solid var(--pl-accent)",
            background: "var(--pl-card-bg)",
          }}
        >
          <div style={{ fontSize: 14, color: "var(--pl-muted)" }}>NyLead Pro</div>
          <div style={{ fontSize: 48, fontWeight: 800, margin: "8px 0" }}>
            {copy.price}
            <span style={{ fontSize: 18, fontWeight: 500 }}> {copy.pricePeriod}</span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "24px 0", textAlign: "left", fontSize: 14 }}>
            {copy.priceFeatures.map((item) => (
              <li key={item} style={{ padding: "6px 0", color: "var(--pl-muted)" }}>
                ✓ {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            style={{
              width: "100%",
              padding: 14,
              background: "var(--pl-cta-bg)",
              color: "var(--pl-cta-text)",
              border: "none",
              borderRadius: "var(--pl-radius)",
              fontWeight: 700,
              cursor: "default",
            }}
          >
            {copy.ctaPrimary}
          </button>
        </div>
      </section>

      {children}

      <footer
        style={{
          padding: "24px 32px",
          borderTop: "1px solid var(--pl-border)",
          fontSize: 12,
          color: "var(--pl-muted)",
          textAlign: "center",
        }}
      >
        Design-lab preview · Produksjon urørt
      </footer>
    </div>
  );
}

function DefaultProductMock({ isDark }: { isDark: boolean }) {
  return (
    <div
      style={{
        borderRadius: "var(--pl-radius-lg)",
        border: "1px solid var(--pl-border)",
        background: isDark ? "var(--pl-mock-bg)" : "#fff",
        boxShadow: "var(--pl-shadow)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--pl-border)",
          display: "flex",
          gap: 6,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#eab308" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["Oslo", "30 dager", "Uten nettside"].map((c) => (
            <span
              key={c}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 999,
                background: "var(--pl-accent-muted)",
                color: "var(--pl-accent)",
              }}
            >
              {c}
            </span>
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              padding: "12px 0",
              borderBottom: "1px solid var(--pl-border)",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
            }}
          >
            <span>Firma {i} AS</span>
            <span style={{ color: "var(--pl-accent)" }}>Ingen nettside</span>
          </div>
        ))}
      </div>
    </div>
  );
}
