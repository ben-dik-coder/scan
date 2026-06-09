"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useNextStep } from "@/components/journey/useNextStep";

export function ScanQueueHint() {
  const { step, loading } = useNextStep();

  if (loading) return null;
  if (!step || step.phase !== "work_queue") return null;

  return (
    <div className="scan-queue-hint flex flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-1 lg:px-5">
      <p className="min-w-0 text-[11px] leading-snug text-slate-500">
        <span className="font-medium text-slate-400">{step.title}</span>
        <span className="hidden sm:inline"> — {step.body}</span>
      </p>
      <Link
        href={step.cta.href}
        className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-[#0a84ff] hover:brightness-110"
      >
        {step.cta.label}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
