import "server-only";

type RequiredEnvKey =
  | "APP_BASE_URL"
  | "TRAIL_API_BASE_URL"
  | "TRAIL_INTERNAL_API_KEY"
  | "TRAIL_AUTH_BASE_URL"
  | "TRAIL_EXTENSION_JWT_SECRET"
  | "AUTH0_DOMAIN"
  | "WAITLIST_PROVIDER_ENDPOINT"
  | "WAITLIST_PROVIDER_TOKEN";

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

const requiredEnvVars: RequiredEnvKey[] = [
  "APP_BASE_URL",
  "TRAIL_API_BASE_URL",
  "TRAIL_INTERNAL_API_KEY",
  "TRAIL_AUTH_BASE_URL",
  "TRAIL_EXTENSION_JWT_SECRET",
  "AUTH0_DOMAIN",
  "WAITLIST_PROVIDER_ENDPOINT",
  "WAITLIST_PROVIDER_TOKEN",
];

const resolved = requireEnv(requiredEnvVars);

export const env = {
  ...resolved,
  ACCOUNT_AUTH_BYPASS: process.env.ACCOUNT_AUTH_BYPASS === "1",
};

