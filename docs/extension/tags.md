# Extension: Tags

**Scope:** `extension/` — tag definitions and node tagging  
**Purpose:** Define tags (label, color, icon); assign/remove tags on nodes; filter by tags in UI.

---

## File Map

| Role | Path |
|------|------|
| Tag type | `extension/src/shared/types/tags.ts` |
| Tag editor modal | `extension/src/sidepanel/ui/components/tags/TagEditorModal.tsx` |
| Tag filter dropdown | `extension/src/sidepanel/ui/components/tags/TagFilterDropdown.tsx` |
| Tag icon options | `extension/src/sidepanel/ui/components/tags/tag-icons.ts` |
| Tag color palette | `extension/src/sidepanel/ui/components/tags/tag-palette.ts` |
| Tag icon component | `extension/src/sidepanel/ui/components/tags/TagIcon.tsx` |
| Tag filter helpers | `extension/src/sidepanel/ui/components/tags/tag-filter-utils.ts` |
| Background tag handlers | `extension/src/background/messaging/handlers/tag-handlers.ts` |
| Background tag-def handlers | `extension/src/background/messaging/handlers/tag-def-handlers.ts` |
| Tag storage | `extension/src/background/services/tag-storage.ts` |

---

## Interfaces

### TagDefinition (shared/types/tags.ts)

```ts
type TagDefinition = {
  id: Tag;           // from ids.ts, e.g. branded string
  label: string;
  color: string;     // hex or rgb
  iconId: string;
  system?: boolean;
  createdAt?: number;
  updatedAt?: number;
};
```

### Tag (ids.ts)

`Tag` is a branded string type used as unique tag id.

### TagEditorValue (TagEditorModal)

```ts
type TagEditorValue = {
  label: string;
  color: string;
  iconId: string;
};
```

### Message types (messages.ts)

- `GET_TAG_DEFS` → returns `TagDefinition[]`
- `UPSERT_TAG_DEF` → payload `{ tagDef: TagDefinition }`
- `DELETE_TAG_DEF` → payload `{ tagId: Tag }`
- `ADD_TAG` / `REMOVE_TAG` → payload `{ nodeId: NodeId; tagId: Tag }`
- `TAGS_UPDATED` (outbound) → payload `{ tagDefs: TagDefinition[] }`

---

## Design Patterns

1. **Tag definitions live in background**  
   Tag storage (e.g. browser.storage via WXT storage wrapper or in-memory) is updated by tag-def handlers; sidepanel sends `GET_TAG_DEFS` and subscribes to `TAGS_UPDATED` for sync.

2. **Node data holds tag ids**  
   `NodeData.tags: Tag[]`; add/remove via `ADD_TAG`/`REMOVE_TAG`; tree is updated and broadcast via `TREE_UPDATED`.

3. **Tag editor**  
   Modal create/edit: label (max 20), color grid, icon grid. On submit: `UPSERT_TAG_DEF`; on delete tag def, optional cascade or block if in use.

4. **Tag filter**  
   TagFilterDropdown uses tag defs and current filter state (e.g. “any of” selected tag ids); filter applied to tree or search results in sidepanel state.

5. **Icons & colors**  
   TAG_ICON_OPTIONS and TAG_COLOR_OPTIONS are fixed lists; TagIcon renders by iconId (e.g. Lucide or custom set).

---

## Validation

- Label: length 1–20, trimmed.
- Color: one of TAG_COLOR_OPTIONS or valid hex.
- iconId: one of TAG_ICON_OPTIONS[].id.

---

## AI Agent Notes

- New tag field: add to `TagDefinition`, storage schema, TagEditorModal, and any serialization.
- Filter semantics: see tag-filter-utils and TagFilterDropdown; extend state shape if you add “and”/“or” or exclusion.
- Graph: tag dots on nodes use `tagDefs` and node `tags`; see GraphPixiRenderer and NodeRenderModel.display.showTagDots.
