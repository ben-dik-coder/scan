"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  header?: ReactNode;
  title?: ReactNode;
  className?: string;
  panelClassName?: string;
  footer?: ReactNode;
  maxWidth?: "md" | "lg";
  /** Fullskjerm på mobil (sm og opp = side-skuff som før). */
  fullScreenMobile?: boolean;
};

export function AppSideDrawer({
  open,
  onClose,
  children,
  header,
  title,
  className,
  panelClassName,
  footer,
  maxWidth = "lg",
  fullScreenMobile = false,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const maxW = maxWidth === "md" ? "max-w-md" : "max-w-lg";

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Lukk"
        className="app-drawer-backdrop fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className={cn(
          "app-side-drawer fixed z-[110] flex flex-col bg-slate-950/95 shadow-2xl backdrop-blur-md",
          fullScreenMobile
            ? [
                "app-side-drawer--fullscreen-mobile inset-0 h-[100dvh] max-h-[100dvh] w-full max-w-none border-0 pt-[env(safe-area-inset-top,0px)]",
                "sm:inset-auto sm:bottom-0 sm:right-0 sm:left-auto sm:top-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:h-auto sm:max-h-none sm:w-full sm:border-l sm:border-white/10 sm:pt-0",
                maxW,
              ]
            : [
                "bottom-0 right-0 w-full border-l border-white/10 top-[calc(3.5rem+env(safe-area-inset-top,0px))]",
                maxW,
              ],
          panelClassName,
          className
        )}
      >
        <div className="relative shrink-0">
          {header ?? (
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 pr-14">
              <div className="min-w-0 flex-1">{title}</div>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white active:scale-95 sm:right-3 sm:top-3 sm:h-9 sm:w-9 sm:rounded-lg"
            aria-label="Lukk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-white/10">{footer}</div>
        ) : null}
      </aside>
    </>,
    document.body
  );
}
