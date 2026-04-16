# Architecture

A tour of how Trail is structured. Read this before making non-trivial changes.

## Stack

- **Framework:** [WXT](https://wxt.dev/) (browser extension framework, MV3)
- **Build:** Vite 7 + esbuild via WXT
- **UI:** React 19, Tailwind CSS v4, shadcn/ui (Radix under the hood), cmdk
- **Graph:** [@xyflow/react](https://reactflow.dev/) + d3-hierarchy layout
- **State:** Zustand (UI) + `chrome.storage.local` (persistence)
- **Transport:** `@webext-core/messaging` (typed) + `@webext-core/proxy-service`
- **Search:** MiniSearch (inverted index per tree)
- **Compression:** fflate (gzip) for archived trees
- **Toasts:** sonner

## Layout

```
src/
├── entrypoints/        # WXT entrypoint files (one per surface)
│   ├── background.ts
│   ├── content.ts
│   ├── sidepanel/
│   └── settings/
├── background/         # Service-worker code (graph mutations, persistence)
│   ├── handlers/       # RPC handler maps
│   ├── navigation/     # Chrome tabs/webNavigation → tree mutation
│   ├── services/       # Storage, layout precompute, background orchestration
│   └── state/          # NavigationTree, TabManager, PinnedManager
├── apps/               # Application-level code per surface
│   ├── sidepanel/
│   │   ├── api/        # Proxy-service clients (tree.ts, commands.ts, …)
│   │   └── ui/         # React components, Zustand store, hooks
│   └── settings/
│       └── ui/
├── features/           # Cross-surface features
│   └── graph/          # React Flow integration, node components, LOD
├── ui/                 # shadcn/ui generated components + design tokens
│   ├── components/
│   └── lib/
├── content/            # Content-script (web↔extension bridge)
└── shared/             # Types, transport contracts, utilities
    ├── config/         # Storage items, site origins, permissions
    ├── lib/            # Commands, compression, mapper, etc.
    ├── platform/       # Browser polyfills
    ├── rpc/            # RPC contracts (background ↔ UI)
    ├── transport/      # Typed messaging primitives
    └── types/          # Shared type definitions
```

## Surfaces

- **Sidepanel** (`src/entrypoints/sidepanel`, `src/apps/sidepanel`) — the main
  UI. Renders the graph, command palette, context menus, tree switcher.
- **Settings** (`src/entrypoints/settings`, `src/apps/settings`) — full tab,
  opens on ⌘, or via menu. Appearance / Behavior / Trees pages.
- **Background service worker** (`src/entrypoints/background.ts`) — holds the
  authoritative `NavigationTree`, handles Chrome tab/webNavigation events,
  persists state, computes layout ahead of time.
- **Content script** (`src/entrypoints/content.ts` + `src/content/`) — thin
  bridge that lets `app.gettrail.net` and `gettrail.net` open the sidepanel
  and initiate the (future) auth handshake.

## Data flow

1. A user navigates in Chrome → `webNavigation` event → background
   `navigation-handler.ts` updates the in-memory `NavigationTree`.
2. The background `tree-storage.ts` service debounces & writes the tree to
   `chrome.storage.local` under `trail_tree`.
3. Every 0–200 ms after a mutation, `layout-precompute.ts` recomputes
   positions and caches them in `session:trail_layout_positions`.
4. The background broadcasts a typed `tree/updated` message. The sidepanel's
   `useRuntimeMessages` hook consumes it and calls the Zustand store's
   `applyTreeState(...)`.
5. React Flow re-renders. Only nodes touched by the diff re-run.

## State ownership

- **Authoritative tree:** lives in the background service worker as a
  `NavigationTree` instance (`src/background/state/nav-tree.ts`).
- **UI mirror:** Zustand store in the sidepanel (`store.ts`) receives
  projected `NavigationTreeJSON` snapshots. UI never mutates the tree
  directly — it calls RPC methods on proxy services
  (`tree.ts`, `actions.ts`, `commands.ts`).
- **Persistence:** `storage-items.ts` centralizes all `storage.defineItem()`
  keys. Never read `chrome.storage` directly — always go through a storage
  item or a service that owns it.

## Rendering

- `@xyflow/react` (React Flow 12) renders the graph.
- `onlyRenderVisibleElements` is on.
- Custom `TrailNode` is a `memo` with a shallow prop comparator.
- LOD system in `features/graph/lod.ts` toggles label/detail/background at
  three zoom thresholds; selectors return booleans so `useStore` only
  re-renders on flip.
- Layout is `d3-hierarchy` Reingold-Tilford, computed either in the
  background (cached) or synchronously on first render after a cache miss.

## Transport (background ↔ UI)

Two primitives from `@webext-core`:

- **Typed messaging** (`shared/transport/extension-messages.ts`) — fire-and-
  forget broadcasts (`TREE_UPDATED`, `TREES_UPDATED`, `NOTIFY`, etc.).
- **Proxy services** (`shared/transport/proxy-services.ts`) — typed request/
  response APIs. Each service is a plain object on the background side whose
  methods are called from the UI as if local.

The website↔extension bridge uses `defineWindowMessaging` with the
`trail-bridge-v1` contract in `content/`.

## Theming

- Tailwind v4 with a custom variant `@custom-variant dark` keyed on
  `[data-theme="dark"]`.
- `useSystemThemeListener` (sidepanel) and a synchronous early-apply script
  (`apply-theme-early.js`) prevent FOUC.
- Tokens are OKLCH, defined in `src/apps/sidepanel/ui/tailwind.css`.
- Components reference semantic tokens (`bg-background`, `text-foreground`,
  `bg-primary/70`, …), never raw Tailwind color scales.

## Storage keys

See `src/shared/config/storage-items.ts` for the canonical list. Summary:

- `local:trail_tree` — active `NavigationTreeJSON`
- `local:trail_tree_meta` — label, timestamps, schema marker
- `local:trail_tree_archives` — list of archived tree summaries
- `local:trail_ar_{treeId}` — gzip-compressed archive payloads
- `local:trail_settings` — `Settings` object
- `local:trail_flags` — `{ v, overrides: Record<FlagId, value> }`
- `local:trail_undo_history` — command stack (last 30)
- `session:trail_layout_positions` — cached per-node positions
- `session:trail_theme_cache` — theme color token cache

## Conventions

- Import from path aliases (`@shared/`, `@background/`, `@features/`, etc.),
  not relative deep paths.
- Never import `@background/*` from sidepanel UI code, except for _types_.
  The enforcement is in `tests/architecture-boundaries.test.ts`.
- Never modify shadcn base components in `src/ui/components/ui/`. Wrap them
  in application code instead.
- Template literals in `className` are banned via ESLint (prevents Tailwind
  JIT from missing classes). Use `cn()` with conditionals.
- All strings in UI eventually go through i18n (`chrome.i18n.getMessage`) —
  scaffolding is under way in Wave 12.
