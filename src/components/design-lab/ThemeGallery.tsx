import Link from "next/link";
import { PREMIUM_THEMES } from "@addons/premium-design-lab/themes/index";

type Props = {
  type: "landing" | "scan";
};

export function ThemeGallery({ type }: Props) {
  const title = type === "landing" ? "Landing-design" : "Skann-design";
  const base = `/design-lab/${type}`;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>
      <Link href="/design-lab" style={{ color: "#64748b", fontSize: 14, textDecoration: "none" }}>
        ← Design-lab
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "16px 0 8px", color: "#f8fafc" }}>
        {title} — 10 varianter
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 32 }}>
        Klikk for fullskjerm. Noter <code>themeId</code> når du har valgt vinner.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {PREMIUM_THEMES.map((t, i) => (
          <Link
            key={t.id}
            href={`${base}/${t.id}`}
            style={{
              display: "block",
              padding: 20,
              borderRadius: 12,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#f8fafc",
              textDecoration: "none",
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>#{i + 1}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{t.nameNo}</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>
              {type === "landing" ? t.landingVibe : t.scanVibe}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Inspirasjon: {t.inspiration} · <code>{t.id}</code>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
