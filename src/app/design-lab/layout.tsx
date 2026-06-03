import Link from "next/link";
import type { ReactNode } from "react";
import "./premium-tokens.css";

export const metadata = {
  title: "Design-lab — NyLead",
  robots: "noindex, nofollow",
};

export default function DesignLabLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <div
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 14,
        }}
      >
        <Link href="/design-lab" style={{ color: "#94a3b8", textDecoration: "none" }}>
          Design-lab
        </Link>
        <Link href="/design-lab/landing" style={{ color: "#94a3b8", textDecoration: "none" }}>
          Landing (10)
        </Link>
        <Link href="/design-lab/scan" style={{ color: "#94a3b8", textDecoration: "none" }}>
          Skann (10)
        </Link>
        <Link href="/" style={{ marginLeft: "auto", color: "#64748b", textDecoration: "none" }}>
          ← Prod forsiden
        </Link>
      </div>
      {children}
    </div>
  );
}
