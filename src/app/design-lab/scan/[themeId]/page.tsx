import { notFound } from "next/navigation";
import { ThemePreviewClient } from "@/components/design-lab/ThemePreviewClient";
import { getThemeById } from "@addons/premium-design-lab/themes/index";

type Props = { params: Promise<{ themeId: string }> };

export async function generateStaticParams() {
  const { PREMIUM_THEMES } = await import("@addons/premium-design-lab/themes/index");
  return PREMIUM_THEMES.map((t) => ({ themeId: t.id }));
}

export default async function DesignLabScanThemePage({ params }: Props) {
  const { themeId } = await params;
  if (!getThemeById(themeId)) notFound();
  return <ThemePreviewClient themeId={themeId} type="scan" />;
}
