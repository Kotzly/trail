import "server-only";

type RequiredEnvKey =
  | "APP_BASE_URL"
  | "BETTER_AUTH_URL"
  | "TRAIL_INTERNAL_API_KEY"
  | "TRAIL_EXTENSION_JWT_SECRET"
  | "POLAR_WEBHOOK_SECRET";

const requiredEnvVars: RequiredEnvKey[] = [
  "APP_BASE_URL",
  "BETTER_AUTH_URL",
  "TRAIL_INTERNAL_API_KEY",
  "TRAIL_EXTENSION_JWT_SECRET",
  "POLAR_WEBHOOK_SECRET",
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

export const env = requireEnv(requiredEnvVars);
