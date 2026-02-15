import { defineConfig, env } from "prisma/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const envCandidates = [
  "DATABASE_URL",
];

const isValidDatabaseUrl = (value: string | undefined | null) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
  } catch {
    return false;
  }
};

const resolveDatabaseUrl = () => {
  for (const key of envCandidates) {
    const candidate = process.env[key];
    if (isValidDatabaseUrl(candidate)) {
      return candidate as string;
    }
  }
  return null;
};

const ensureDatabaseUrl = () => {
  // Prisma config expects DATABASE_URL. For developer convenience we accept common
  // provider-specific env vars and map them to DATABASE_URL.
  let resolved = resolveDatabaseUrl();

  if (!resolved) {
    const candidates = [
      ".env.local",
      ".env",
      "apps/account/.env.local",
      "apps/account/.env",
      "apps/api/.env.local",
      "apps/api/.env",
      "packages/db/.env.local",
      "packages/db/.env"
    ].map((rel) => path.join(rootDir, rel));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        dotenv.config({ path: candidate });
        resolved = resolveDatabaseUrl();
        if (resolved) break;
      }
    }
  }

  if (resolved && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = resolved;
  }
};

ensureDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: env("DATABASE_URL")
  }
});
