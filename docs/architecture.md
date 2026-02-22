# Trail — Architecture Overview

## High-Level Diagram

```mermaid
graph TB
    subgraph Client
        EXT["🧩 Extension<br/>(WXT + Pixi.js + React 18)"]
        BROWSER["Browser<br/>(Chrome / Brave)"]
    end

    subgraph Vercel["Vercel (Hosting)"]
        subgraph Apps
            ACCOUNT["apps/account<br/>Next.js 16 · app.gettrail.net<br/>Dashboard · Auth · API"]
            MARKETING["apps/marketing<br/>Next.js 16 · gettrail.net<br/>Landing · Legal · SEO"]
        end
    end

    subgraph External
        NEON[("Neon PostgreSQL")]
        SANITY["Sanity CMS"]
        GOOGLE["Google OAuth"]
        NOWPAY["NOWPayments"]
        TELEGRAM["Telegram"]
    end

    subgraph Monorepo Packages
        DB["@trail/db<br/>Prisma 7 · PG adapter"]
        TRPC["@trail/trpc<br/>Router · Procedures"]
        UI["@trail/ui<br/>Components · Tailwind preset"]
        CONTENT["@trail/content<br/>Copy strings · Plans"]
        CONFIG["@trail/config<br/>TSConfig presets"]
    end

    subgraph Standalone
        SANITY_STUDIO["sanity/<br/>CMS Studio"]
        VIDEO["apps/video<br/>Remotion 4"]
        BOT["apps/support-bot<br/>grammY"]
    end

    EXT -- "OAuth2 PKCE" --> ACCOUNT
    EXT -- "REST /api/v1/trails/*" --> ACCOUNT
    EXT -- "Session state" --> ACCOUNT
    BROWSER -- "Side panel UI" --> EXT

    ACCOUNT --> DB
    ACCOUNT --> TRPC
    ACCOUNT --> UI
    ACCOUNT --> CONTENT
    ACCOUNT -- "Better Auth" --> GOOGLE
    ACCOUNT -- "Billing webhooks" --> NOWPAY
    DB --> NEON

    MARKETING --> UI
    MARKETING -- "GROQ queries" --> SANITY
    MARKETING --> CONTENT

    TRPC --> DB

    SANITY_STUDIO -- "webhook /api/revalidate" --> MARKETING
    BOT --> TELEGRAM
```

## Services & Apps

### `apps/account` — Dashboard & API

| | |
|---|---|
| **URL** | `app.gettrail.net` |
| **Stack** | Next.js 16, React 19, Better Auth, tRPC, Prisma |
| **Port** | 4001 (dev) / 3001 (prod) |
| **Role** | User dashboard, auth provider, REST + tRPC API |

API surface:

```
/api/auth/[...all]          Better Auth (login, session, JWKS)
/api/trpc/[trpc]            tRPC endpoint
/api/v1/oauth/*             OAuth2 PKCE (authorize, token, revoke)
/api/v1/trails/*            Tree CRUD, sync, import, restore
/api/v1/subscription/*      Subscription lifecycle
/api/v1/billing/*           Portal, webhooks (NOWPayments)
/api/v1/account             Account info
/api/v1/auth/*              Session state, logout, bridge, portal
/api/v1/plans               Plan definitions
/api/v1/onboarding          Onboarding status
```

---

### `apps/marketing` — Landing Page

| | |
|---|---|
| **URL** | `gettrail.net` |
| **Stack** | Next.js 16, React 19, Three.js, Motion, Sanity client |
| **Port** | 3000 |
| **Role** | Landing page, legal pages (privacy, terms), SEO, OG |

Content is pulled from Sanity CMS via GROQ queries. Sanity webhook triggers `/api/revalidate` for ISR.

---

### `extension/` — Browser Extension

| | |
|---|---|
| **Stack** | WXT 0.20, Pixi.js 8, React 18, Zustand, MiniSearch |
| **Version** | 0.9.0 |
| **Role** | Visualize browsing history as interactive tree in side panel |

Separate pnpm workspace. Architecture:

```
extension/
├── entrypoints/
│   ├── background.ts          Service worker
│   ├── content.ts             Content script
│   └── sidepanel/             Side panel (React app)
├── src/
│   ├── background/
│   │   ├── services/          Auth, tree-storage, sync, quota, settings
│   │   ├── messaging/         RPC router + handlers
│   │   ├── navigation/        WebNavigation events
│   │   ├── state/             Background state
│   │   └── tabs/              Tab tracking
│   ├── content/               Content script logic
│   ├── shared/                Types, config, schemas
│   └── sidepanel/
│       ├── ui/                Components, graph renderer, hooks
│       └── api/               API layer
```

---

### `apps/video` — Demo Videos

Remotion 4.0 compositions for promo/demo videos.

### `apps/support-bot` — Telegram Bot

grammY-based support chat bot, deployed as standalone process.

### `sanity/` — CMS Studio

Sanity Studio for managing marketing content (hero sections, features, CTAs, site settings). Separate npm project.

---

## Shared Packages

```mermaid
graph LR
    ACCOUNT["apps/account"] --> DB["@trail/db"]
    ACCOUNT --> TRPC["@trail/trpc"]
    ACCOUNT --> UI["@trail/ui"]
    ACCOUNT --> CONTENT["@trail/content"]
    
    MARKETING["apps/marketing"] --> UI
    MARKETING --> CONTENT
    
    TRPC --> DB
    UI --> CONTENT
    
    ACCOUNT --> CONFIG["@trail/config"]
    MARKETING --> CONFIG
```

| Package | Purpose |
|---|---|
| `@trail/db` | Prisma 7 client + PG adapter. Models: User, Session, Trail, Subscription, Device, OAuth tokens, etc. |
| `@trail/trpc` | Shared tRPC router, procedures, extension token signing (HMAC-SHA256 JWT) |
| `@trail/ui` | UI components (Button, Card, Badge…), marketing components (Nav, Footer, Pricing…), auth views, Tailwind preset, icons |
| `@trail/content` | Copy strings for marketing & account. Plan definitions (Free / Pro $8/mo / Teams $16/mo) |
| `@trail/config` | Shared `tsconfig.base.json` and `tsconfig.next.json` |

---

## Auth Flow

```mermaid
sequenceDiagram
    participant Ext as Extension
    participant Account as apps/account
    participant Google as Google OAuth
    participant DB as Neon PostgreSQL

    Note over Ext: User clicks "Login"
    Ext->>Account: GET /api/v1/oauth/authorize (PKCE)
    Account->>Google: Redirect to Google OAuth
    Google-->>Account: Callback with code
    Account->>DB: Create/find user
    Account-->>Ext: Auth code via redirect
    Ext->>Account: POST /api/v1/oauth/token (code + verifier)
    Account-->>Ext: Access token + Refresh token
    Note over Ext: Stores tokens locally
    
    loop Token Refresh
        Ext->>Account: POST /api/v1/oauth/token (refresh_token)
        Account-->>Ext: New access + refresh tokens
    end
```

---

## Data Flow — Tree Sync

```mermaid
sequenceDiagram
    participant Ext as Extension
    participant BG as Background (Service Worker)
    participant API as apps/account API
    participant DB as Neon PostgreSQL

    Note over Ext: User browses the web
    BG->>BG: WebNavigation events → build tree
    BG->>BG: Store in chrome.storage.local
    
    Note over BG: Sync triggered
    BG->>API: POST /api/v1/trails/sync
    API->>DB: Upsert trails
    DB-->>API: OK
    API-->>BG: Sync result
```

---

## Database Schema (key models)

```mermaid
erDiagram
    User ||--o{ Session : has
    User ||--o{ Account : has
    User ||--o| AccountSettings : has
    User ||--o{ Trail : owns
    User ||--o| UserSubscription : has
    User ||--o{ Device : has
    User ||--o{ OAuthAuthorizationCode : has
    User ||--o{ OAuthRefreshToken : has
    Device ||--o{ DeviceSession : has
    
    User {
        string id PK
        string name
        string email
        string image
    }
    Trail {
        string id PK
        string userId FK
        json data
        datetime createdAt
    }
    UserSubscription {
        string id PK
        string userId FK
        enum plan
        enum status
        enum billingProvider
    }
```

---

## Infrastructure

```
┌─────────────────────────────────────────────────────┐
│                    GitHub Actions                     │
│  ci-web.yml          ci-extension.yml    neon.yml    │
│  typecheck + build   test + build      DB branches   │
└──────────┬──────────────────┬───────────────┬───────┘
           │                  │               │
     ┌─────▼─────┐    ┌──────▼──────┐  ┌─────▼─────┐
     │   Vercel   │    │ Chrome Web  │  │   Neon    │
     │  account   │    │   Store     │  │ PostgreSQL│
     │  marketing │    │  extension  │  │  (+ PR    │
     │            │    │             │  │  branches)│
     └────────────┘    └─────────────┘  └───────────┘
```

| Layer | Technology |
|---|---|
| Hosting | Vercel (web apps) |
| Database | Neon PostgreSQL (branch-per-PR in CI) |
| CMS | Sanity (studio + CDN) |
| Auth | Better Auth + Google OAuth |
| Payments | NOWPayments (crypto billing) |
| CI/CD | GitHub Actions |
| Local dev DB | Docker Compose (PostgreSQL 18) |
| Monorepo | pnpm workspaces |
| E2E tests | Cypress |
| Unit tests | Vitest |

---

## Subscription Plans

| Plan | Price | Limits |
|---|---|---|
| Free | $0 | Basic features |
| Pro | $8/mo · $72/yr | Full features |
| Teams | $16/mo · $144/yr | Multi-user |
