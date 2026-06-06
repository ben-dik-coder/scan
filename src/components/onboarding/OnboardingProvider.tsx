"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppTutorial } from "@/components/onboarding/AppTutorial";
import {
  getOnboardingStatus,
  setOnboardingStatus,
  shouldAutoShowOnboarding,
  type OnboardingStatus,
} from "@/lib/onboarding/storage";

type OnboardingContextValue = {
  status: OnboardingStatus | null;
  openOnboarding: () => void;
  canRestart: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding må brukes innenfor OnboardingProvider");
  }
  return ctx;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const refreshStatus = useCallback(() => {
    setStatus(getOnboardingStatus());
  }, []);

  useEffect(() => {
    refreshStatus();
    setHydrated(true);

    const onChange = () => refreshStatus();
    window.addEventListener("nylead-onboarding-change", onChange);
    return () => window.removeEventListener("nylead-onboarding-change", onChange);
  }, [refreshStatus]);

  useEffect(() => {
    if (!hydrated) return;
    if (shouldAutoShowOnboarding()) setOpen(true);
  }, [hydrated]);

  const openOnboarding = useCallback(() => setOpen(true), []);

  const handleComplete = useCallback(() => {
    setOnboardingStatus("completed");
    setOpen(false);
  }, []);

  const handleSkip = useCallback(() => {
    setOnboardingStatus("skipped");
    setOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    if (getOnboardingStatus() === null) {
      setOnboardingStatus("skipped");
    }
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      status,
      openOnboarding,
      canRestart: true,
    }),
    [status, openOnboarding]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <AppTutorial
        open={open}
        onClose={handleClose}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </OnboardingContext.Provider>
  );
}
