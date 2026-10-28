"use client";

import type { AppThemeId } from "@/lib/theme/app-theme";

type Props = {
  compact?: boolean;
  className?: string;
};

/** Theme is locked to Skann/Ring look — selector hidden. */
export function ThemeSelector(_props?: Props) {
  void _props;
  return null;
}

export function ThemeSelectorField(props: {
  value: AppThemeId;
  onChange: (theme: AppThemeId) => void;
}) {
  void props;
  return null;
}
