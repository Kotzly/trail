import "@testing-library/jest-dom";

process.env.APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3001";
process.env.TRAIL_API_BASE_URL =
  process.env.TRAIL_API_BASE_URL ?? "http://localhost:3002";
process.env.TRAIL_INTERNAL_API_KEY =
  process.env.TRAIL_INTERNAL_API_KEY ?? "test-internal-key";
process.env.TRAIL_AUTH_BASE_URL =
  process.env.TRAIL_AUTH_BASE_URL ?? "http://localhost:3003";
process.env.TRAIL_EXTENSION_JWT_SECRET =
  process.env.TRAIL_EXTENSION_JWT_SECRET ?? "test-extension-secret";
process.env.AUTH0_DOMAIN = process.env.AUTH0_DOMAIN ?? "auth0.test";
process.env.WAITLIST_PROVIDER_ENDPOINT =
  process.env.WAITLIST_PROVIDER_ENDPOINT ?? "http://localhost:3999/waitlist";
process.env.WAITLIST_PROVIDER_TOKEN =
  process.env.WAITLIST_PROVIDER_TOKEN ?? "test-waitlist-token";
process.env.ACCOUNT_AUTH_BYPASS = process.env.ACCOUNT_AUTH_BYPASS ?? "0";
