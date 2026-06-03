"use client";

import Image from "next/image";
import { MapPin, ScanSearch, Send, UserCheck, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const WORKFLOW_STEP_IMAGES = [
  "/images/workflow/workflow-step-1.png",
  "/images/workflow/workflow-step-2.png",
  "/images/workflow/workflow-step-3.png",
  "/images/workflow/workflow-step-4.png",
] as const;

const WORKFLOW_FALLBACK_ICONS: LucideIcon[] = [MapPin, ScanSearch, UserCheck, Send];

type Props = {
  step: number;
  className?: string;
};

function WorkflowStepSvgFallback({ step, className }: Props) {
  const index = Math.min(Math.max(step - 1, 0), WORKFLOW_FALLBACK_ICONS.length - 1);
  const Icon = WORKFLOW_FALLBACK_ICONS[index];

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-brand-gold/10",
        className
      )}
      aria-hidden
    >
      <Icon className="h-6 w-6 text-[#635bff]" strokeWidth={2} />
    </div>
  );
}

export function WorkflowStepIcon({ step, className }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const index = Math.min(Math.max(step - 1, 0), WORKFLOW_STEP_IMAGES.length - 1);
  const src = WORKFLOW_STEP_IMAGES[index];

  if (imgFailed) {
    return <WorkflowStepSvgFallback step={step} className={className} />;
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="48px"
      aria-hidden
      className={cn("object-cover", className)}
      onError={() => setImgFailed(true)}
    />
  );
}
