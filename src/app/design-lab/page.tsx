import Link from "next/link";

export default function DesignLabIndexPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Premium design-lab</h1>
      <p style={{ color: "#94a3b8", lineHeight: 1.6, marginBottom: 32 }}>
        Ti Apollo-inspirerte temaer for landing og skann. Produksjon (<code>/</code> og{" "}
        <code>/app</code>) er urørt — alt her er add-on.
      </p>
      <div style={{ display: "grid", gap: 16 }}>
        <Link
          href="/design-lab/landing"
          style={{
            display: "block",
            padding: 24,
            borderRadius: 12,
            border: "1px solid #334155",
            background: "#1e293b",
            color: "#f8fafc",
            textDecoration: "none",
          }}
        >
          <strong style={{ fontSize: 20 }}>Landing — 10 design</strong>
          <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 14 }}>
            Hero, funksjoner, pris-mock per tema
          </p>
        </Link>
        <Link
          href="/design-lab/scan"
          style={{
            display: "block",
            padding: 24,
            borderRadius: 12,
            border: "1px solid #334155",
            background: "#1e293b",
            color: "#f8fafc",
            textDecoration: "none",
          }}
        >
          <strong style={{ fontSize: 20 }}>Skann — 10 design</strong>
          <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 14 }}>
            Filter, Google-sjekk, firmaliste per tema
          </p>
        </Link>
      </div>
    </main>
  );
}
