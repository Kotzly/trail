import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key";
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
