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
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "SUPABASE_DATABASE_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_POOLER_URL"
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

const resolveCaCert = () => {
  const candidate =
    process.env.SUPABASE_CA_CERT ??
    process.env.DATABASE_CA_CERT ??
    process.env.POSTGRES_CA_CERT;
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (trimmed.includes("BEGIN CERTIFICATE")) return trimmed;
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    if (decoded.includes("BEGIN CERTIFICATE")) return decoded;
  } catch {
    // fall through to returning raw value
  }
  return trimmed;
};

let databaseUrl = resolveDatabaseUrl();

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
    "Missing database connection string. Set DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL / SUPABASE_DB_URL)."
  );
}

const caCert = resolveCaCert();
const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: databaseUrl,
    ...(caCert ? { ssl: { ca: caCert, rejectUnauthorized: true } } : {})
  });

const adapter = new PrismaPg(pool);

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaPool = pool;
}

export type { PrismaClient };
