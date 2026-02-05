# Packages: Database (Prisma)

**Scope:** `packages/db/`  
**Purpose:** Prisma schema, client, and generated types for PostgreSQL; User and ExtensionLoginCode models.

---

## File Map

| Role | Path |
|------|------|
| Schema | `packages/db/prisma/schema.prisma` |
| Client export | `packages/db/src/client.ts` |
| Generated | `packages/db/src/generated/` (client, enums, models) |

---

## Schema

```prisma
datasource db {
  provider = "postgresql"
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  image     String?
  imageUrl  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  extensionLoginCodes ExtensionLoginCode[]
}

model ExtensionLoginCode {
  id        String   @id @default(cuid())
  code      String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## Design Patterns

1. **Single client**  
   Import PrismaClient from packages/db; instantiate once (singleton or per-request in serverless). Do not edit generated files.

2. **Migrations**  
   - Dev (create/apply): `pnpm db:migrate` (`prisma migrate dev`)
   - Prod (apply only): `pnpm --filter @trail/db prisma migrate deploy`
   - Migrations are committed under `packages/db/prisma/migrations/` (see README there).

3. **Extensions**  
   Login codes: create with userId, code, expiresAt; mark used by setting usedAt when exchanged.

---

## AI Agent Notes

- New model: add to schema, run migrate, use generated types.  
- Relation: ExtensionLoginCode.userId → User.id; cascade delete optional (e.g. on User delete).  
- Env: Prisma datasource uses `DATABASE_URL` (and `packages/db/prisma.config.ts` also accepts `POSTGRES_PRISMA_URL` / `POSTGRES_URL` and maps it to `DATABASE_URL`). See `.env.example`.
