import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ?? "0123456789abcdef0123456789abcdef";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";
process.env.TRAIL_EXTENSION_JWT_SECRET =
  process.env.TRAIL_EXTENSION_JWT_SECRET ?? "test-extension-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/trail?schema=public";
process.env.BILLING_PROVIDER = process.env.BILLING_PROVIDER ?? "manual";
process.env.BILLING_TEST_MODE = process.env.BILLING_TEST_MODE ?? "1";
process.env.NOWPAYMENTS_API_KEY =
  process.env.NOWPAYMENTS_API_KEY ?? "test-nowpayments-key";
process.env.NOWPAYMENTS_IPN_SECRET =
  process.env.NOWPAYMENTS_IPN_SECRET ?? "test-nowpayments-secret";
process.env.NOWPAYMENTS_API_BASE_URL =
  process.env.NOWPAYMENTS_API_BASE_URL ?? "https://api.nowpayments.io";
process.env.ACCOUNT_AUTH_BYPASS = process.env.ACCOUNT_AUTH_BYPASS ?? "0";
