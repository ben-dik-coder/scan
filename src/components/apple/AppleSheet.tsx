"use client";

import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function AppleSheet({ open, onClose, title, children }: Props) {
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        className="apple-sheet-backdrop"
        aria-label="Lukk"
        onClick={onClose}
      />
      <div className="apple-sheet" role="dialog" aria-modal="true">
        <div className="apple-sheet-handle" />
        {title ? <h2 className="mb-3 text-lg font-semibold">{title}</h2> : null}
        {children}
      </div>
    </>
  );
}
