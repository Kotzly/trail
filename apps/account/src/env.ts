import "server-only";

type RequiredEnvKey =
  | "BETTER_AUTH_SECRET"
  | "BETTER_AUTH_URL"
  | "BETTER_AUTH_TRUSTED_ORIGINS"
  | "AUTH_BRIDGE_DEFAULT_RETURN_TO"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "TRAIL_EXTENSION_JWT_SECRET"
  | "APP_BASE_URL"
  | "DATABASE_URL";

export type BillingProviderName = "manual" | "nowpayments";

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

const requiredEnvVars: RequiredEnvKey[] = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "AUTH_BRIDGE_DEFAULT_RETURN_TO",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "TRAIL_EXTENSION_JWT_SECRET",
  "APP_BASE_URL",
  "DATABASE_URL",
];

const resolved = requireEnv(requiredEnvVars);

export const env = {
  ...resolved,
  ACCOUNT_AUTH_BYPASS: readBooleanEnv(process.env.ACCOUNT_AUTH_BYPASS),
  BILLING_PROVIDER: normalizeBillingProvider(process.env.BILLING_PROVIDER),
  BILLING_TEST_MODE: readBooleanEnv(process.env.BILLING_TEST_MODE),
  NOWPAYMENTS_API_KEY: readOptionalEnv(process.env.NOWPAYMENTS_API_KEY),
  NOWPAYMENTS_IPN_SECRET: readOptionalEnv(process.env.NOWPAYMENTS_IPN_SECRET),
  NOWPAYMENTS_API_BASE_URL: readOptionalEnv(process.env.NOWPAYMENTS_API_BASE_URL),
  WAITLIST_PROVIDER_ENDPOINT: readOptionalEnv(process.env.WAITLIST_PROVIDER_ENDPOINT),
  WAITLIST_PROVIDER_TOKEN: readOptionalEnv(process.env.WAITLIST_PROVIDER_TOKEN),
};
