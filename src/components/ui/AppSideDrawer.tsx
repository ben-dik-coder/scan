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
          "app-side-drawer fixed bottom-0 right-0 z-[110] flex w-full flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-md",
          maxW,
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
            className="absolute right-3 top-3 z-10 rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
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
