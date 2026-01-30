# Trail Documentation Index

Documentation is organized by **scope** and **feature**. Each file is under 500 lines and written for AI-agent ingestion: interfaces, design patterns, file maps, and concise notes.

## PRDs

| Doc | Scope |
|-----|--------|
| [prd/landing.md](prd/landing.md) | gettrail.net: hero, downloads, support, legal |
| [prd/dashboard.md](prd/dashboard.md) | app.gettrail.net: dashboard, settings, billing, extension |
| [prd/extension-cloud-features.md](prd/extension-cloud-features.md) | Extension ↔ cloud: auth, code exchange, token |

## Scopes

| Scope | Path | Description |
|-------|------|-------------|
| **extension** | `docs/extension/` | Chrome/Brave extension: sidepanel UI, background, shared types |
| **apps/marketing** | `docs/apps/marketing/` | gettrail.net: hero, carousel, legal, support, nav |
| **apps/account** | `docs/apps/account/` | app.gettrail.net: auth, dashboard, billing, settings |
| **apps/api** | `docs/apps/api/` | api.gettrail.net: internal API, tRPC |
| **packages** | `docs/packages/` | Shared: db, trpc, content, ui |

## Extension (`docs/extension/`)

| Doc | Feature |
|-----|---------|
| [theme-picker.md](extension/theme-picker.md) | Custom theme editor (light/dark/system + palette, presets, tokens) |
| [graph.md](extension/graph.md) | Pixi graph renderer, LOD, layout (tree/mindmap/radial) |
| [tags.md](extension/tags.md) | Tag definitions, node tagging, filter, editor modal |
| [search.md](extension/search.md) | In-tree search, results, focus/cycle |
| [background-messaging.md](extension/background-messaging.md) | Message router, MSG types, handlers |
| [tree-and-nodes.md](extension/tree-and-nodes.md) | Tree/node data model, storage, JSON types |

## Apps: Marketing (`docs/apps/marketing/`)

| Doc | Feature |
|-----|---------|
| [carousel.md](apps/marketing/carousel.md) | Testimonials carousel (auto-scroll, reduced motion) |
| [hero.md](apps/marketing/hero.md) | Hero, word rotator, CTAs |
| [legal.md](apps/marketing/legal.md) | Privacy & Terms from markdown |
| [support.md](apps/marketing/support.md) | Support page, email, quick checks |
| [nav-and-footer.md](apps/marketing/nav-and-footer.md) | Nav and footer layout |

## Apps: Account (`docs/apps/account/`)

| Doc | Feature |
|-----|---------|
| [auth-and-extension.md](apps/account/auth-and-extension.md) | Auth0, extension JWT, login code, exchange |
| [dashboard.md](apps/account/dashboard.md) | Dashboard, app shell |
| [billing-and-settings.md](apps/account/billing-and-settings.md) | Billing, settings, v1 routes |

## Apps: API (`docs/apps/api/`)

| Doc | Feature |
|-----|---------|
| [internal-api.md](apps/api/internal-api.md) | Internal routes, extension login code, users |
| [trpc.md](apps/api/trpc.md) | tRPC router, procedures, context |

## Packages (`docs/packages/`)

| Doc | Feature |
|-----|---------|
| [db.md](packages/db.md) | Prisma schema, User, ExtensionLoginCode |
| [trpc.md](packages/trpc.md) | Shared router, procedures |
| [content.md](packages/content.md) | Copy strings (marketing, account) |
| [ui.md](packages/ui.md) | Shared components, Tailwind preset |

## Conventions

- **File map:** First table in each doc lists key files by role.
- **Interfaces:** TypeScript types/interfaces relevant to the feature.
- **Design patterns:** How the feature is structured (state, messaging, persistence).
- **AI Agent notes:** Extension points, env, and cross-references.
