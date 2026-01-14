# Trail

Trail is a Chrome/Brave (Chromium) extension that turns your browsing into a navigable tree and renders it in the browser side panel. It is a Manifest V3 extension with a background service worker, a content script for title updates, and a React-based side panel UI. All data lives in the browser profile (no backend).

This README is a description of what exists in the codebase today (not a roadmap).

## What Trail does

### Captures navigation into a global tree
- Builds a single global navigation tree across all windows and tabs.
- Listens to `chrome.webNavigation` events:
  - `onCommitted` (normal navigations)
  - `onHistoryStateUpdated` (SPA history updates)
  - `onReferenceFragmentUpdated` (hash changes)
- Uses `chrome.tabs` events to keep the "current" node in sync with the active tab.
- Reuses an existing node if the URL already exists in the tree (global reuse), otherwise creates a new node.
- Keeps a mapping of open tabs per node and tracks last-used tabs for cycling.

### Tree storage and eviction
- The tree is stored in `chrome.storage.local` (see `src/background/services/tree-storage.ts`).
- Nodes contain:
  - URL, title, favicon
  - pinned flag
  - tags array
  - optional per-node layout offsets (for tree/mindmap) or radial adjustments
- Tree capacity is enforced by an LRU-style eviction policy based on node timestamps.
  - Pinned nodes are never evicted (`NavigationTree.canRemove` checks `pinned`).
  - Capacity exists in settings but is not exposed in the UI (defaults to Infinity).

### Side panel UI (graph view)
The UI is a single interactive graph view with three layout modes:
- **Tree**
- **Mindmap**
- **Radial**

Key interactions:
- Pan and zoom (mouse wheel, trackpad pinch, +/- keys, 0 to reset).
- Tool switch between Select and Hand (V / H).
- Drag nodes to adjust their layout position; adjustments are persisted per node.
- Selection rectangle for multi-select; Cmd/Ctrl adds to selection.
- Context menu on a node with:
  - Open in this tab
  - Open in new tab
  - List of open tabs for that node (click to focus)
  - Pin/unpin
  - Tags submenu (add/remove tag, edit/delete tag, create new tag)
  - Copy URL / Copy title
  - Delete node / delete children / delete subtree
- Bulk selection context menu with:
  - Pin/unpin selected
  - Tags submenu (add/remove tags across selection)
  - Close selected tabs
  - Delete selected nodes

### Search
- Cmd/Ctrl+F focuses the search field.
- Matches against title, URL, and domain (case-insensitive).
- Matched nodes are highlighted; non-matches are dimmed.
- Next/previous and accept/cancel actions are exposed in the search UI.
- Search uses a temporary selection session to preview/focus results.

### Tags
- Tags are stored on nodes (array of tag IDs).
- Tag definitions are stored in `chrome.storage.sync` and can be created/edited/deleted.
- Default tag presets live in `src/shared/data/tag-presets.ts`.
- Nodes display tag dots.
- Tag filter dropdown:
  - Opens next to the pinned list button.
  - Top strip shows only tags that are currently used by at least one node.
  - Default view shows all nodes that have any tag.
  - Selecting tags filters nodes with OR semantics.
  - Each node in the list shows its own tags.

### Pins
- Pinned nodes are visually marked.
- Pinned list dropdown shows all pinned nodes and lets you jump to them.
- Pinned nodes are excluded from tree eviction.

### Tabs and audio state
- Nodes show tab counts when multiple tabs exist for the same node.
- Audio/mute state is reflected on the node; mute can be toggled from the node UI.
- Clicking a node focuses an existing tab for that node (cycles through open tabs if multiple), otherwise opens a new tab.

### Undo / redo
- Undo/redo buttons in the side panel, with Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z shortcuts.
- History is kept in memory only (static CommandManager). Restarting the service worker clears history.
- Max history length is 30 snapshots.

### Notifications (UI only)
- A notification system exists in the UI, but it is not currently used by core flows.

## Settings (side panel)
Accessible via the gear button.

- **Theme**: Light / Dark / System
- **Tab limit**: UI allows setting a max open tab limit (0 = unlimited)
  - Note: LRU tab-closing logic exists in code but is not currently wired into navigation, so this setting is not enforced yet.
- **Title truncation**: Start / Middle / End
- **Layout mode**: Mindmap / Tree / Radial
- **Layout parameters**: sliders specific to each layout mode
- **Reset**:
  - Reset to defaults (layout params)
  - Reset view (layout params + per-node offsets)

## Data storage and privacy
- **Tree data**: `chrome.storage.local`
- **Settings**: `chrome.storage.sync`
- **Tag definitions**: `chrome.storage.sync`
- No external network calls are made by the extension itself.

## Permissions (from `public/manifest.json`)
- `sidePanel`: render Trail UI in the browser side panel
- `storage`: persist tree/settings/tags
- `tabs`: map nodes to tabs, focus/create/close tabs
- `webNavigation`: build the tree from navigation events
- `scripting`: reserved for injection (not used heavily in current code)
- `favicon`: read favicon URLs
- `host_permissions: <all_urls>`: needed to observe navigation across all sites

## Build and run

Install dependencies:
```bash
npm install
```

Development (UI only):
```bash
npm run dev:ui
```

TypeScript watch:
```bash
npm run watch
```

Full build (produces `dist/`):
```bash
npm run build
```
This runs `tsc`, builds the UI with Vite, and then copies/rewrites the manifest via `scripts/build-extension.js`.

Load in Chrome/Brave:
1. Go to `chrome://extensions` or `brave://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked" and select the `dist/` folder.

## Tests

There is a small Node-based test:
```bash
npm test
```
It validates basic tree deletion behavior and undo/redo snapshots.

## Project layout (current)
```
trail/
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── background/          # service worker, navigation, tabs, messaging
│   ├── content/             # content script (title changes)
│   ├── sidepanel/           # React UI, state, styles
│   └── shared/              # shared types, layout defaults, tree serialization
├── scripts/
│   └── build-extension.js   # rewrites manifest paths and copies icons into dist/
├── tests/
│   └── basic.test.ts
├── dist/                    # build output (generated)
├── package.json
└── README.md
```

## Known gaps / TODOs
- Tab limit UI exists, but automatic tab closing is not wired yet.
- Capacity is part of settings but not exposed in the UI.
- Notifications are implemented in UI but not used by core flows.

---
