# Trail Documentation Index

Documentation is organized by **scope** and **feature**. Each file is under 500 lines and written for AI-agent ingestion: interfaces, design patterns, file maps, and concise notes.

## PRDs

| Doc | Scope |
|-----|--------|
| [prd/share-trails.md](prd/share-trails.md) | Extension + site: export/import branches, public share links |
| [prd/polar-billing.md](prd/polar-billing.md) | Billing integration with Polar |
| [prd/user-flow-redesign.md](prd/user-flow-redesign.md) | User flow redesign |

## Scopes

| Scope | Path | Description |
|-------|------|-------------|
| **extension** | `docs/extension/` | Chrome/Brave extension: sidepanel UI, background, shared types |
| **apps/marketing** | `docs/apps/marketing/` | gettrail.net: hero, carousel, legal, support, nav |
| **apps/account** | `docs/apps/account/` | app.gettrail.net: web app + auth + API runtime |
| **packages** | `docs/packages/` | Shared: db, trpc, content, ui |

## Dev (`docs/dev/`)

| Doc | Topic |
|-----|-------|
| [dev/orchestration.md](dev/orchestration.md) | Autonomous dev playbook (worktrees, checks) |
| [dev/release.md](dev/release.md) | Full release checklist (web apps + extension) |
| [dev/release-checklist.md](dev/release-checklist.md) | Quick DB/Prisma release checklist |
| [dev/backlog.md](dev/backlog.md) | Agent backlog |

## Extension (`docs/extension/`)

| Doc | Feature |
|-----|---------|
| [extension/graph.md](extension/graph.md) | Pixi graph renderer, LOD, layout (tree/mindmap/radial) |
| [extension/theme-picker.md](extension/theme-picker.md) | Custom theme editor (light/dark/system + palette, presets, tokens) |
| [extension/tags.md](extension/tags.md) | Tag definitions, node tagging, filter, editor modal |
| [extension/search.md](extension/search.md) | In-tree search, results, focus/cycle |
| [extension/background-messaging.md](extension/background-messaging.md) | Message router, MSG types, handlers |
| [extension/tree-and-nodes.md](extension/tree-and-nodes.md) | Tree/node data model, storage, JSON types |

## Apps: Marketing (`docs/apps/marketing/`)

| Doc | Feature |
|-----|---------|
| [apps/marketing/hero.md](apps/marketing/hero.md) | Hero, word rotator, CTAs |
| [apps/marketing/carousel.md](apps/marketing/carousel.md) | Testimonials carousel (auto-scroll, reduced motion) |
| [apps/marketing/nav-and-footer.md](apps/marketing/nav-and-footer.md) | Nav and footer layout |
| [apps/marketing/legal.md](apps/marketing/legal.md) | Privacy & Terms from markdown |
| [apps/marketing/support.md](apps/marketing/support.md) | Support page, email, quick checks |

## Apps: Account (`docs/apps/account/`)

| Doc | Feature |
|-----|---------|
| [apps/account/auth-and-extension.md](apps/account/auth-and-extension.md) | Better Auth, extension JWT, login code, exchange |
| [apps/account/dashboard.md](apps/account/dashboard.md) | Dashboard, app shell |
| [apps/account/billing-and-settings.md](apps/account/billing-and-settings.md) | Billing, settings, v1 routes |

## Packages (`docs/packages/`)

| Doc | Feature |
|-----|---------|
| [packages/db.md](packages/db.md) | Prisma schema, User, ExtensionLoginCode |
| [packages/trpc.md](packages/trpc.md) | Shared router, procedures |
| [packages/content.md](packages/content.md) | Copy strings (marketing, account) |
| [packages/ui.md](packages/ui.md) | Shared components, Tailwind preset |

## Plans (`docs/plans/`)

Design documents and implementation plans for completed or in-progress work. Named by date + topic.

## Prompts (`docs/prompts/`)

AI prompts used for building UI components in marketing and account apps.

## Conventions

- **File map:** First table in each doc lists key files by role.
- **Interfaces:** TypeScript types/interfaces relevant to the feature.
- **Design patterns:** How the feature is structured (state, messaging, persistence).
- **AI Agent notes:** Extension points, env, and cross-references.
