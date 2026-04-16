# Trail — Visual Browsing History

Trail is a Chrome extension that turns your browsing into an interactive,
navigable graph. Every click, back-button, and tab-duplicate becomes a node
in a tree you can revisit, organize, and pick up where you left off.

- **Sidepanel-first** — your trail lives alongside whatever you're reading.
- **Local-first** — your browsing data stays on your device until you opt
  into cloud sync.
- **Graph, not a list** — the shape of your research is as meaningful as
  the pages themselves.

## Install

- **Chrome Web Store:** https://chromewebstore.google.com/ *(link added at v1.0 launch)*
- **Unpacked / dev:** see [CONTRIBUTING.md](./CONTRIBUTING.md)

## Features

- **Navigation graph** — every page you visit becomes a node. Forks when you
  navigate from a tab twice. Merges when you revisit the same URL.
- **Command palette** (⌘K / Ctrl+K) — instant search across all nodes.
- **Pinned nodes** — mark important pages for quick access.
- **Multiple trees** — switch between research sessions.
- **Tree editing** — delete nodes, reparent, pin, duplicate subtrees, undo
  with ⌘Z.
- **Light / dark theme** — follows system preference by default.
- **Local-first** — uses `chrome.storage.local`. Cloud sync is opt-in.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` / `/` | Open command palette |
| `⌘Z` / `⌘⇧Z` | Undo / Redo |
| `⌘,` | Open Settings |
| `⌘A` / `⌘⇧A` | Select all / Clear |
| `⌘Enter` | Open selection in new tab |
| `Enter` | Navigate to selected node |
| `Delete` / `Backspace` | Delete node (or subtree with `⇧`) |
| `←` `→` `↑` `↓` | Move focus between siblings / parent / child |
| `P` | Toggle pin on selection |
| `⇧L` | Cycle layout (tree ↔ mindmap) |
| `⇧C` | Toggle connector lines |
| `⌘/` | Show shortcuts cheat-sheet |

## Privacy

- By default, nothing leaves your device.
- If you sign in, your tree is synced via [Supabase](https://supabase.com).
- Full text at [gettrail.net/privacy](https://gettrail.net/privacy).

## Project layout

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the extension is structured
- [CONTRIBUTING.md](./CONTRIBUTING.md) — setup, scripts, commit style
- [CSP-RATIONALE.md](./CSP-RATIONALE.md) — Content Security Policy stance
- [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) — pre-publish checks
- [tasks/todo.md](./tasks/todo.md) — current work plan
- [tasks/lessons.md](./tasks/lessons.md) — lessons learned, project conventions

## License

Proprietary. © 2026 Trail.
