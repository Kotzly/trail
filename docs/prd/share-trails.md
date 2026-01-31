# PRD: Share Trails (export/import branches)

**Product:** Trail extension + gettrail.net / app.gettrail.net  
**Scope:** Export selected subtrees/branches from extension; import branches via JSON or website; public share links (v0)  
**Status:** Living doc  

---

## 0. Ivan decisions (v0)

- **Selection “full фарш”:** export supports subtree, whole tree, multiple branches, and selecting a path range (“from → to”).
- **IDs:** on import we **regenerate NodeIds** to avoid collisions.
- **Import placement modes (in addition to “New tree”):**
  1) **Auto-merge** by URL+timestamp heuristics
  2) **Manual:** user chooses the **parent node** per imported subtree/branch
  3) **As new branches** inside current tree under a “synthetic parent” (e.g. “New Tab” root / import group)
- **Share links:** public for now; later add workspace-scoped access → design API with auth hooks.
- **Export packaging:** one export = one JSON file, but it may contain **multiple branches**.
- **Multi-branch import:** must show preview + user chooses targets per branch.

---

## 1. Goals & Success

### 1.1 Goals

- **Export:** User can pick parts of a trail (nodes/branches/subtrees, whole tree, ranges) and export them.
- **Share:** User can generate a public share link that others can open and import.
- **Import:** User can import one or many branches either from a JSON file or from a website share link.
- **Placement:** Import UX supports: merge into current tree (auto/manual/synthetic parent) or import as a new tree.
- **Reliability:** Import/export is deterministic, versioned, and resilient to partial/malformed data.

### 1.2 Success metrics

- Export JSON downloads succeed without errors.
- Share link creation succeeds and can be imported by another user within 1 minute.
- Import error rate low; when errors happen, they are actionable (clear message, “what to do next”).

---

## 2. Non-goals (for v0)

- Real-time collaborative editing of the same tree.
- Fine-grained permissions (workspace roles). (Design hooks only.)
- Perfect semantic deduping across trees (we’ll offer heuristic merge + manual placement).
- Server-side storage of full browsing history beyond the exported branches.

---

## 3. Personas / User Stories

### 3.1 Personas

- **Researcher / Analyst:** wants to share a curated subset of browsing as “context”.
- **Teammate / Reviewer:** wants to import only relevant branches into their own tree.
- **Power user:** wants “from-to” and multi-branch selection and precise placement.

### 3.2 Key user stories

- “I want to export a branch of my trail as JSON to attach in docs.”
- “I want to share a public link so someone else can import the branch.”
- “I received a JSON with several branches; I want to preview and import each under chosen parents.”
- “I received a share link; I want the site to open the extension and import it.”

---

## 4. Terminology

- **Tree / Trail:** a navigation tree maintained by the extension.
- **Node:** a single visited page record (URL, title, favicon, tags, layout, timestamp).
- **Branch:** a path/subtree rooted at a selected node.
- **Subtree:** a node + all its descendants.
- **Selection:** a set of export roots or a (from,to) range within the tree.
- **Export bundle:** one JSON file containing 1..N exported branches + metadata.
- **Import placement:** where and how imported branches are inserted.

---

## 5. Existing mechanisms to reuse

### 5.1 “Open extension from website” (already exists)

Website → extension opening uses postMessage handshake:

- Marketing helper: `apps/marketing/app/lib/trail-extension.ts` (`openTrailPanel()`)
- Extension content script: `extension/src/content/content-script.ts`
  - listens for `{ source: "trail-site", type: "OPEN_TRAIL_PANEL" }`
  - ACKs `{ source: "trail-extension", type: "OPEN_TRAIL_PANEL_ACK", ok, error }`
- Then the content script triggers `MSG.OPEN_PANEL` → background handler opens the side panel.

Origin restrictions:
- `extension/src/content/content-script.ts` has `ALLOWED_ORIGINS` including:
  - `https://gettrail.net`, `https://app.gettrail.net`, `http://localhost:3000`, etc.

**PRD requirement:** share/import via website must use this same “open trail panel” flow.

### 5.2 Tree serialization foundation

- Tree JSON model: `extension/src/shared/types/tree.ts` (`NavigationTreeJSON`)
- Nodes: `extension/src/shared/types/node.ts`
- IDs: `extension/src/shared/types/ids.ts` (`NodeId`, `Timestamp`, …)
- Storage: `extension/src/background/services/tree-storage.ts`
- ID generation: `extension/src/background/state/tree-node.ts` uses an in-memory counter.

Implication: on import we must **remap NodeIds** to new unique IDs and rebuild parent/child edges.

---

## 6. User Flows

### 6.1 Export JSON (extension)

**Entry points** (v0 suggestions):
- Context menu on graph selection (there is already multi-select state in UI: `selectedNodeIds`).
- “Share/Export” section inside sidepanel UI.

**Steps:**
1) User selects export content:
   - Subtree from a node
   - Whole tree
   - Multiple branches (multiple roots)
   - Range selection (“from → to”) (UI needs a way to pick start/end nodes)
2) User opens “Export / Share”.
3) User chooses export method → **Download JSON**.
4) Extension prepares export bundle (see data format) and triggers file download.
5) UI shows toast: “Exported X branches (Y nodes).”

**Notes:**
- Deduplicate nested roots: if user selects a node that is inside another selected subtree, keep only the highest ancestor root.

### 6.2 Share via website (extension → cloud)

**Steps:**
1) User selects subtree/branches/range as in 6.1.
2) User chooses “Share via link”.
3) Extension creates export bundle.
4) Extension uploads export bundle to API (public share) → receives `shareId` + `shareUrl`.
5) Extension shows share URL and offers “Copy link”.

**Later:** add auth/workspace gating without changing the client data format.

### 6.3 Import JSON (extension)

**Steps:**
1) User chooses “Import” in extension.
2) User picks a `.json` file.
3) Extension parses bundle, validates version, shows preview:
   - branches list + node counts
   - root node titles/URLs
4) User chooses import destination:
   - **New tree**
   - **Current tree** → and then chooses placement mode:
     - Auto-merge (heuristics)
     - Manual per branch parent selection
     - New branches under synthetic parent
5) User confirms.
6) Extension imports:
   - remap NodeIds
   - apply placement
   - store updated tree(s)
7) UI shows result with errors/warnings if any.

### 6.4 Import via website (website → extension)

Two supported situations:

#### 6.4.1 User opens share link in browser (no extension panel open)
1) User visits `https://gettrail.net/share/<id>`.
2) Site calls `openTrailPanel()` (existing mechanism).
3) If ACK ok → site sends `POST_MESSAGE_IMPORT` to content script (new message type) with payload:
   - either the full export bundle (small payload)
   - or a short token/id (site fetches, then sends the bundle)
4) Extension receives import request and opens “Import preview” UI.

#### 6.4.2 User already has side panel open
1) Site still calls `openTrailPanel()` (or no-op if open) to guarantee panel.
2) Sends import request.

**Security:**
- Only allowed origins can trigger import.
- Import message must include `requestId` and optional signature/token from site.
- Extension must validate bundle schema and enforce size limits.

---

## 7. UX & Interaction details

### 7.1 Selection UX (“full фарш”)

We need to support:
- **Subtree**: select one node → “Export subtree”.
- **Whole tree**: “Export current tree”.
- **Multiple branches**: multi-select nodes → “Export selected branches”.
- **From → To range**:
  - user chooses a start node and an end node
  - system determines the path/range definition (see open questions below)

Recommended controls:
- Context menu on node:
  - “Set as range start”
  - “Set as range end”
  - “Export range”
- Multi-select:
  - “Export selected roots” (dedup nested)

### 7.2 Import preview UX

For a bundle with multiple branches:
- List branches with:
  - root title/url
  - node count
  - depth
  - warnings (missing titles, invalid urls, tags unknown)
- For each branch user selects destination:
  - New tree
  - Current tree → parent picker (manual mode)

### 7.3 Placement & appearance in graph

- Manual mode should let user pick parent node from current tree.
- Synthetic parent mode creates a grouping node like:
  - title: “Imported branches”
  - url: `about:blank` (or another safe URL)
  - pinned: false
  - tags: optional (“imported”)

**Note:** Navigation behavior for synthetic nodes should not create noisy tabs; treat it as non-navigable in UI if possible.

---

## 8. Data format

### 8.1 Export bundle (versioned)

One file = one export.

```json
{
  "schema": "trail.export.v1",
  "exportedAt": 1730000000000,
  "source": {
    "extensionVersion": "0.0.1",
    "treeId": "<optional: archive id if available>",
    "treeLabel": "<optional>",
    "origin": "extension"
  },
  "selection": {
    "kind": "subtree|whole-tree|multi-branch|range",
    "roots": ["<nodeId>"] ,
    "range": { "from": "<nodeId>", "to": "<nodeId>", "mode": "path" }
  },
  "branches": [
    {
      "branchId": "<uuid>",
      "root": { /* NavigationNodeJSON */ }
    }
  ],
  "meta": {
    "nodeCount": 123,
    "warnings": []
  }
}
```

Notes:
- `branches[].root` uses the existing `NavigationNodeJSON` shape.
- NodeIds inside exported JSON are **source ids** only; on import we remap.

### 8.2 Import remapping

On import:
- Build `oldNodeId -> newNodeId` map.
- Rebuild all nodes and parent/children references.
- Optionally preserve timestamps from export; if timestamps are used in heuristics, keep them.

### 8.3 Heuristic merge inputs

For auto-merge, heuristics can use:
- URL equality
- Timestamp proximity
- Title similarity (optional)
- Existing open tabs mapping (see `navigation-handlers.ts` and tab manager logic)

---

## 9. Edge cases & handling

| Case | Expected behavior | UX |
|------|-------------------|----|
| JSON schema unknown | Reject import | “Unsupported export version” + link to update extension |
| Huge file | Reject or warn | “File too large” + size limit shown |
| Multiple branches with overlap | Dedup (keep highest roots) or import separately based on selection kind | Preview shows “X branches merged/deduped” |
| Tags referenced but tagDefs missing | Import tags as raw IDs; UI shows without styling until defs exist | Warning in preview |
| Synthetic parent navigated | Prevent opening tabs if node is synthetic | Treat as non-navigable or safe URL |
| Auto-merge ambiguous | Fall back to manual prompt | “We couldn’t merge confidently — pick parent” |
| Import into current tree causes clutter/layout overlap | Offer “Auto-layout imported nodes” toggle | Option in import modal |

---

## 10. Technical constraints

- MV3 service worker constraints: must keep import/export logic robust to worker suspension.
- `chrome.sidePanel` APIs: open/enable requires correct tab context; website uses postMessage handshake.
- Allowed origins: must keep `ALLOWED_ORIGINS` in content script updated for share/import pages.
- File download/upload:
  - JSON export uses Blob + `download` or chrome downloads API.
  - JSON import uses `<input type=file>` in sidepanel UI.
- API:
  - v0 public: `POST /api/share` returns `shareId, url`
  - `GET /share/<id>` returns export bundle
  - design with future auth (workspace) without changing bundle schema.

---

## 11. Open questions (remaining)

1) “From → To range”: what does it mean precisely?
   - path along tree from `from` to `to` (must be ancestor/descendant?)
   - or all nodes visited between timestamps?
   - proposed v0: **path mode** only; enforce that `to` is in subtree of `from`, else error.
2) Synthetic parent URL / navigation policy: do we allow clicking it? (Prefer: no-op / focus only.)
3) Auto-merge confidence thresholds: when to stop and ask manual.
 
---

## 12. Implementation notes (non-binding)

- Add new message types for website-driven import, parallel to `OPEN_TRAIL_PANEL`:
  - `IMPORT_TRAIL_BUNDLE` + ACK.
- Add background handlers:
  - `EXPORT_BUNDLE`
  - `IMPORT_BUNDLE`
- Sidepanel UI:
  - selection UI + export modal
  - import modal with preview and placement options.
