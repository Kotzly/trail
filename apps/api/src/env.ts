import "server-only";

type RequiredEnvKey =
  | "APP_BASE_URL"
  | "BETTER_AUTH_URL"
  | "TRAIL_INTERNAL_API_KEY"
  | "TRAIL_EXTENSION_JWT_SECRET";

export type BillingProviderName = "manual" | "nowpayments";

const requiredEnvVars: RequiredEnvKey[] = [
  "APP_BASE_URL",
  "BETTER_AUTH_URL",
  "TRAIL_INTERNAL_API_KEY",
  "TRAIL_EXTENSION_JWT_SECRET",
];

function requireEnv(keys: RequiredEnvKey[]): Record<RequiredEnvKey, string> {
  const errors: string[] = [];
  const values = {} as Record<RequiredEnvKey, string>;
  for (const key of keys) {
    const value = process.env[key];
    if (!value) {
      errors.push(`Missing ${key} environment variable`);
    } else {
      values[key] = value;
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  return values;
}

function normalizeBillingProvider(value: unknown): BillingProviderName {
  if (typeof value !== "string") {
    return "manual";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "manual" || normalized === "nowpayments") {
    return normalized;
  }
  // Backward-compatible alias for previous provider key.
  if (normalized === "stub") {
    return "manual";
  }
  return "manual";
}

function readOptionalEnv(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readBooleanEnv(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function readStringListEnv(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export const env = {
  ...requireEnv(requiredEnvVars),
  BILLING_TEST_MODE: readBooleanEnv(process.env.BILLING_TEST_MODE),
  BILLING_PROVIDER: normalizeBillingProvider(process.env.BILLING_PROVIDER),
  BETTER_AUTH_ALLOWED_ISSUERS: readStringListEnv(
    process.env.BETTER_AUTH_ALLOWED_ISSUERS,
  ),
  NOWPAYMENTS_API_KEY: readOptionalEnv(process.env.NOWPAYMENTS_API_KEY),
  NOWPAYMENTS_IPN_SECRET: readOptionalEnv(process.env.NOWPAYMENTS_IPN_SECRET),
  NOWPAYMENTS_API_BASE_URL: readOptionalEnv(process.env.NOWPAYMENTS_API_BASE_URL),
};
