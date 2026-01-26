import { PrismaClient } from "./generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

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
  ];

  for (const candidate of candidates) {
    const resolved = path.resolve(process.cwd(), candidate);
    if (fs.existsSync(resolved)) {
      dotenv.config({ path: resolved });
      if (process.env.DATABASE_URL) {
        break;
      }
    }
  }
}

const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL
  });

const adapter = new PrismaPg(pool);

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaPool = pool;
}

export type { PrismaClient };
