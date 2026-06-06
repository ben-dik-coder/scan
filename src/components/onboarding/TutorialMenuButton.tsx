"use client";

import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { cn } from "@/lib/utils";
import { GraduationCap } from "lucide-react";

type Props = {
  className?: string;
  onOpen?: () => void;
};

export function TutorialMenuButton({ className, onOpen }: Props) {
  const { openOnboarding, status } = useOnboarding();

  return (
    <button
      type="button"
      onClick={() => {
        openOnboarding();
        onOpen?.();
      }}
      className={cn("glass-nav-link w-full", className)}
    >
      <GraduationCap className="h-4 w-4 shrink-0" />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span>Veiledning</span>
        {status !== "completed" ? (
          <span className="rounded-full bg-sky-400/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-100">
            Ny
          </span>
        ) : null}
      </span>
    </button>
  );
}
