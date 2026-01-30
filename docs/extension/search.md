# Extension: Search

**Scope:** `extension/` — sidepanel in-tree search  
**Purpose:** Full-text search over the current tree; highlight and cycle matches; optional tag/query combo.

---

## File Map

| Role | Path |
|------|------|
| Search hook | `extension/src/sidepanel/ui/hooks/useSearch.ts` |
| Floating search UI | `extension/src/sidepanel/ui/components/FloatingSearch.tsx` |
| Search results list | `extension/src/sidepanel/ui/components/SearchResultsList.tsx` |
| Search state | `extension/src/sidepanel/ui/state/store.ts` (search slice) |
| Tree search (findNodesByQuery) | extension shared tree implementation (e.g. MiniSearch or walk + match) |

---

## Interfaces

### Search state (store)

Typical shape (names may vary):

```ts
search: {
  query: string;
  active: boolean;
  baseCurrentId: NodeId | null;  // tree position when search started
  results: NodeId[];            // ordered match list
  index: number;                // current result index (0-based)
};
```

### useSearch API

- `performSearch(query: string)` — set query and baseCurrentId; derive results and set index (e.g. last result when query changes).
- `focusResult(index: number)` — clamp index to results length and set.
- `nextResult()` / `prevResult()` — cycle index.
- `selectResult(nodeId)` — navigate to node, optionally close search.
- `clearSearch()` — clear query, results, active.

---

## Design Patterns

1. **Query → results**  
   When `search.query` changes, run `tree.findNodesByQuery(search.query)` (or equivalent); store result ids and optionally set index to last. Same query keeps previous index (clamped).

2. **Base node**  
   When search activates, store `currentNodeId` as `baseCurrentId`. If user navigates away (`currentNodeId !== baseCurrentId`), search is cleared so results stay tied to the tree “context” at activation.

3. **Index cycling**  
   `focusResult((index % len + len) % len)` for wraparound; graph/sidepanel highlight `results[index]` and optionally center on it.

4. **Integration with graph**  
   NodeRenderModel has `isSearchMatch`, `isSearchFocused`, `isSearchDimmed`; renderer uses these for highlight and LOD (focused node stays full detail).

---

## Tree search implementation

- Often implemented with MiniSearch (extension/src/shared/vendor/minisearch.ts) or a simple recursive walk matching title/URL.
- Index built from current tree; `findNodesByQuery(query)` returns array of NodeId in display order (e.g. pre-order).

---

## AI Agent Notes

- To add “search in tags”: extend query parsing or filter results by selected tag ids after text match.
- Store shape: ensure FloatingSearch and SearchResultsList read from the same store slice; useSearch is the single place that updates results and index.
- Shortcuts: useShortcuts or global key handler typically calls performSearch (e.g. Ctrl+F) and next/prev (e.g. Enter / Shift+Enter).
