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
  auth0Id   String   @unique
  email     String?
  name      String?
  imageUrl  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  loginCodes ExtensionLoginCode[]
}

model ExtensionLoginCode {
  id        String   @id @default(cuid())
  code      String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  expiresAt DateTime
  usedAt    DateTime?
}
```

---

## Design Patterns

1. **Single client**  
   Import PrismaClient from packages/db; instantiate once (singleton or per-request in serverless). Do not edit generated files.

2. **Migrations**  
   `pnpm db:migrate` (or `npx prisma migrate deploy`); migrations live in prisma/migrations.

3. **Extensions**  
   Login codes: create with userId, code, expiresAt; mark used by setting usedAt when exchanged.

---

## AI Agent Notes

- New model: add to schema, run migrate, use generated types.  
- Relation: ExtensionLoginCode.userId → User.id; cascade delete optional (e.g. on User delete).  
- Env: datasource url from env (e.g. DATABASE_URL); see .env.example.
