const PRIMARY_KEYS = [
  "API1881_SUBSCRIPTION_KEY",
  "API1881_SUBSCRIPTION_KEY_PRIMARY",
] as const;

const SECONDARY_KEYS = [
  "API1881_SUBSCRIPTION_KEY_SECONDARY",
] as const;

function firstEnv(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function getApi1881PrimaryKey(): string | null {
  return firstEnv(PRIMARY_KEYS);
}

export function getApi1881SecondaryKey(): string | null {
  return firstEnv(SECONDARY_KEYS);
}

export function hasApi1881(): boolean {
  return Boolean(getApi1881PrimaryKey() || getApi1881SecondaryKey());
}

export const API1881_BASE_URL = "https://services.api1881.no/";
