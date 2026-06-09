"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useNextStep } from "@/components/journey/useNextStep";

export function ScanQueueHint() {
  const { step, loading } = useNextStep();

  if (loading) return null;
  if (!step || step.phase !== "work_queue") return null;

  return (
    <div className="scan-queue-hint flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.06] px-4 py-2 lg:px-5">
      <p className="min-w-0 text-xs text-slate-400">
        <span className="font-medium text-slate-300">{step.title}</span>
        <span> — {step.body}</span>
      </p>
      <Link
        href={step.cta.href}
        className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-[#0a84ff] hover:brightness-110"
      >
        {step.cta.label}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
