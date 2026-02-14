import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          globals: true,
          environment: "jsdom",
          setupFiles: "./vitest.setup.ts",
          include: [
            "app/**/__tests__/**/*.test.tsx",
            "app/components/**/__tests__/**/*.test.tsx",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          globals: true,
          environment: "node",
          setupFiles: "./vitest.setup.ts",
          include: [
            "app/api/**/*.test.ts",
            "src/server/**/*.test.ts",
            "src/lib/**/*.test.ts",
            "src/**/*.test.ts",
          ],
        },
      },
    ],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "vitest.server-only.ts"),
      "next/headers": path.resolve(__dirname, "vitest.next-headers.ts"),
    },
  },
});
