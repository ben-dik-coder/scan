"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useNextStep } from "@/components/journey/useNextStep";

export function ScanQueueHint() {
  const { step, loading } = useNextStep();

  if (loading) return null;
  if (!step || step.phase !== "work_queue") return null;

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/[0.1] bg-white/[0.03] px-3 py-2">
      <p className="min-w-0 text-xs text-zinc-400">
        <span className="font-medium text-zinc-200">{step.title}</span>
        <span className="hidden sm:inline"> — {step.body}</span>
      </p>
      <Link
        href={step.cta.href}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-zinc-200 hover:text-white"
      >
        {step.cta.label}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
