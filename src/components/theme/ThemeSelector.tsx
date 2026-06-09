"use client";

import { APP_THEME_OPTIONS, type AppThemeId } from "@/lib/theme/app-theme";
import { cn } from "@/lib/utils";
import { Monitor, Palette } from "lucide-react";
import { useAppTheme } from "./AppThemeProvider";

type Props = {
  compact?: boolean;
  className?: string;
};

export function ThemeSelector({ compact = false, className }: Props) {
  const { theme, setTheme, ready } = useAppTheme();

  if (!ready) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {!compact && (
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-sky-400" aria-hidden />
          <p className="scan-glass-strong text-sm font-semibold">Utseende</p>
        </div>
      )}
      <div
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-2" : "sm:grid-cols-2"
        )}
        role="radiogroup"
        aria-label="Velg utseende"
      >
        {APP_THEME_OPTIONS.map((option) => {
          const active = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(option.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition",
                active
                  ? "border-sky-400/45 bg-sky-400/12"
                  : "border-white/15 bg-white/5 hover:bg-white/8"
              )}
            >
              <span className="scan-glass-strong flex items-center gap-2 text-sm font-semibold">
                <Monitor className="h-4 w-4 shrink-0" aria-hidden />
                {option.label}
              </span>
              {!compact && (
                <span className="scan-glass-muted mt-1 block text-xs leading-snug">
                  {option.description}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ThemeSelectorField({
  value,
  onChange,
}: {
  value: AppThemeId;
  onChange: (theme: AppThemeId) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Velg utseende">
      {APP_THEME_OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-xl border px-3 py-3 text-left transition",
              active
                ? "border-sky-400/45 bg-sky-400/12"
                : "border-white/15 bg-white/5 hover:bg-white/8"
            )}
          >
            <span className="scan-glass-strong text-sm font-semibold">{option.label}</span>
            <span className="scan-glass-muted mt-1 block text-xs leading-snug">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
