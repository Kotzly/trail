import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Provide env stubs so packages/db/src/client.ts's lazy init
    // doesn't blow up on first property access inside tests. Real
    // integration tests (vs supabase start) can override these.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
      NODE_ENV: "test",
    },
    include: ["src/**/*.test.ts"],
  },
});
