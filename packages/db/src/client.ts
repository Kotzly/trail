import { PrismaClient } from "./generated/client";
export { Prisma } from "./generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

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

let databaseUrl = resolveDatabaseUrl();

// todo: remove file env checks
if (!databaseUrl) {
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
      databaseUrl = resolveDatabaseUrl();
      if (databaseUrl) {
        break;
      }
    }
  }
}

if (!databaseUrl) {
  throw new Error(
    "Missing database connection string. Set DATABASE_URL."
  );
}

const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("neon.tech") ? { rejectUnauthorized: true } : undefined,
  });

const adapter = new PrismaPg(pool);

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaPool = pool;
}

export type { PrismaClient };
