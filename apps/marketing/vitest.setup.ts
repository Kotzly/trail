import "@testing-library/jest-dom";

process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
process.env.NEXT_PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
process.env.WAITLIST_PROVIDER_ENDPOINT =
  process.env.WAITLIST_PROVIDER_ENDPOINT ?? "http://localhost:3999/waitlist";
process.env.WAITLIST_PROVIDER_TOKEN =
  process.env.WAITLIST_PROVIDER_TOKEN ?? "test-waitlist-token";
