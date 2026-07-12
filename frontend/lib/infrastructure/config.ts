const requiredPublicEnv = ["NEXT_PUBLIC_EXPORT_API_URL"] as const;

type PublicEnvKey = (typeof requiredPublicEnv)[number];

export type PublicConfig = {
  exportApiUrl: string;
  exportPollIntervalMs: number;
};

export function getPublicConfig(): PublicConfig {
  return {
    exportApiUrl: readRequiredEnv("NEXT_PUBLIC_EXPORT_API_URL"),
    exportPollIntervalMs: readPositiveIntegerEnv("NEXT_PUBLIC_EXPORT_POLL_INTERVAL_MS", 500),
  };
}

function readRequiredEnv(key: PublicEnvKey): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.replace(/\/+$/, "");
}

function readPositiveIntegerEnv(key: string, fallback: number): number {
  const value = process.env[key]?.trim();
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
