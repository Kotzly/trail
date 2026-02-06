process.env.APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3001";
process.env.BETTER_AUTH_URL =
  process.env.BETTER_AUTH_URL ?? "http://localhost:3003";
process.env.TRAIL_INTERNAL_API_KEY =
  process.env.TRAIL_INTERNAL_API_KEY ?? "test-internal-key";
process.env.TRAIL_EXTENSION_JWT_SECRET =
  process.env.TRAIL_EXTENSION_JWT_SECRET ?? "test-extension-secret";
process.env.BILLING_PROVIDER = process.env.BILLING_PROVIDER ?? "manual";
