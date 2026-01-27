import { defineConfig, env } from "prisma/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

if (!process.env.DATABASE_URL) {
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
      if (process.env.DATABASE_URL) {
        break;
      }
    }
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: env("DATABASE_URL")
  }
});
