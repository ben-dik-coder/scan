"use client";

import Link from "next/link";
import { Component, type ComponentType, type ReactNode } from "react";
import { getThemeById } from "@addons/premium-design-lab/themes/index";
import { getThemePreviews } from "@addons/premium-design-lab/registry-client";

type Props = {
  themeId: string;
  type: "landing" | "scan";
};

class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <p style={{ padding: 48, color: "#f87171", textAlign: "center" }}>
          Kunne ikke vise dette temaet. Prøv et annet fra galleriet.
        </p>
      );
    }
    return this.props.children;
  }
}

export function ThemePreviewClient({ themeId, type }: Props) {
  const meta = getThemeById(themeId);
  const pair = getThemePreviews(themeId);
  const galleryHref = `/design-lab/${type}`;

  let Preview: ComponentType | null = null;
  if (pair) {
    Preview = type === "landing" ? pair.LandingPreview : pair.ScanPreview;
  }

  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          background: "rgba(15,23,42,0.95)",
          borderBottom: "1px solid #334155",
          fontSize: 13,
        }}
      >
        <Link href={galleryHref} style={{ color: "#94a3b8", textDecoration: "none" }}>
          ← Alle {type === "landing" ? "landing" : "skann"}
        </Link>
        <span style={{ color: "#f8fafc", fontWeight: 600 }}>
          {meta?.nameNo ?? themeId} · {type}
        </span>
        <span style={{ marginLeft: "auto", color: "#64748b" }}>
          <code>{themeId}</code>
        </span>
      </div>
      {!pair || !Preview ? (
        <p style={{ padding: 48, color: "#f87171", textAlign: "center" }}>
          Ukjent tema: {themeId}
        </p>
      ) : (
        <PreviewErrorBoundary>
          <Preview />
        </PreviewErrorBoundary>
      )}
    </div>
  );
}
