export const ONBOARDING_STORAGE_KEY = "nylead-onboarding-v1";

export type OnboardingStatus = "completed" | "skipped";

export function getOnboardingStatus(): OnboardingStatus | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
  if (raw === "completed" || raw === "skipped") return raw;
  return null;
}

export function shouldAutoShowOnboarding(): boolean {
  return getOnboardingStatus() === null;
}

export function setOnboardingStatus(status: OnboardingStatus) {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, status);
  window.dispatchEvent(new CustomEvent("nylead-onboarding-change", { detail: status }));
}

export function clearOnboardingStatus() {
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("nylead-onboarding-change", { detail: null }));
}
