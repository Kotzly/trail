# Prisma migrations

This directory contains **committed Prisma migrations** for the Trail database.

## Why this exists
- Production deployments should apply migrations via **`prisma migrate deploy`**.
- Keeping migrations in git makes releases reproducible.

## Common commands

> All commands require a valid connection string. Set `DATABASE_URL`.
> If you only have `POSTGRES_PRISMA_URL` / `POSTGRES_URL`, `packages/db/prisma.config.ts` maps it to `DATABASE_URL` for Prisma CLI.

### Local development (create/apply migrations)
```bash
pnpm db:migrate
# or
pnpm --filter @trail/db prisma migrate dev
```

### Production (apply existing migrations)
```bash
pnpm --filter @trail/db prisma migrate deploy
```

### Generate Prisma client
```bash
pnpm db:generate
# or
pnpm --filter @trail/db prisma generate
```

## Notes
- Do **not** edit existing migration SQL files after they have shipped.
- The baseline migration is `*_init/`.
