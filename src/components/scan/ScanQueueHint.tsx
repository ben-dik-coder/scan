"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useNextStep } from "@/components/journey/useNextStep";

export function ScanQueueHint() {
  const { step, loading } = useNextStep();

  if (loading) return null;
  if (!step || step.phase !== "work_queue") return null;

  return (
    <div className="scan-queue-hint flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-sky-400/10 px-2.5 py-2 lg:px-3">
      <p className="min-w-0 text-xs text-slate-200">
        <span className="font-semibold text-white">{step.title}</span>
        <span className="text-slate-400"> — {step.body}</span>
      </p>
      <Link
        href={step.cta.href}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-400"
      >
        {step.cta.label}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
