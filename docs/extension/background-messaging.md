# Extension: Background Messaging

**Scope:** `extension/` — service worker ↔ sidepanel/content  
**Purpose:** Central message router; typed request/response; handlers for tree, tabs, settings, tags, pin, navigation, undo, content.

---

## File Map

| Role | Path |
|------|------|
| Router init | `extension/src/background/messaging/router.ts` |
| Message types | `extension/src/shared/types/messages.ts` |
| Navigation | `extension/src/background/messaging/handlers/navigation-handlers.ts` |
| Tabs | `extension/src/background/messaging/handlers/tab-handlers.ts` |
| Tree | `extension/src/background/messaging/handlers/tree-handlers.ts` |
| Settings | `extension/src/background/messaging/handlers/settings-handlers.ts` |
| Tags / tag defs | `tag-handlers.ts`, `tag-def-handlers.ts` |
| Pin | `pin-handlers.ts` |
| Undo/redo | `undo-handlers.ts` (command-handlers) |
| Content | `content-handlers.ts` |
| Send from UI | `extension/src/sidepanel/api/background.ts` (sendMessage to runtime) |

---

## Message Protocol

### Request/Response

- **Request:** `{ type: MSG.<TYPE>, ...payload }`.  
- **Response:** `{ success: true, data?: T }` or `{ success: false, error: string }`.  
- Channel: `chrome.runtime.onMessage.addListener`; handler returns `true` to keep channel open for async `sendResponse`.

### Type safety

- `RequestMessage` = union of all request types.  
- `ResponseMessage<T>` = response for request type `T`.  
- `ResponseDataByType` maps each `MSG.*` to response data type.  
- `MessageHandler<T>` = `(message: MessageByType<T>, sender) => Promise<ResponseMessage<T>> | ResponseMessage<T>`.  
- `defineHandlers({ [MSG.X]: handler })` for type-checked handler map.

### Outbound-only (no request handler)

- `TREE_UPDATED`, `TREES_UPDATED`, `TAGS_UPDATED`, `NOTIFY` — background or content sends to sidepanel; router returns err if received as request.

---

## Message Catalog (MSG)

- **Navigation:** NAVIGATE_TO, PREVIEW_NODE, SET_CURRENT.  
- **Temp selection:** BEGIN_TEMP_SELECTION, PREVIEW_TEMP_SELECTION, ACCEPT_TEMP_SELECTION, CANCEL_TEMP_SELECTION, END_TEMP_SELECTION.  
- **Undo:** UNDO, REDO, COMMAND_STATE.  
- **Tags:** GET_TAG_DEFS, UPSERT_TAG_DEF, DELETE_TAG_DEF.  
- **Tabs:** GET_TABS_FOR_NODE, TOGGLE_MUTE, CLOSE_TAB, BULK_CLOSE_TABS.  
- **Settings:** SAVE_SETTINGS, GET_SETTINGS, TITLE_OR_FAVICON_CHANGED.  
- **Tree:** GET_TREE, GET_TREES, CLEAR_TREE, NEW_TREE, OPEN_TREE, RENAME_TREE, DELETE_ARCHIVED_TREE; TREE_UPDATED, TREES_UPDATED (outbound).  
- **Pin:** TOGGLE_PIN, BULK_PIN, BULK_UNPIN.  
- **Tags on nodes:** ADD_TAG, REMOVE_TAG.  
- **Delete:** DELETE_NODE, DELETE_CHILDREN, DELETE_WITH_CHILDREN, BULK_DELETE, BULK_DELETE_NODES, BULK_DELETE_RECURSIVE.  
- **Layout:** SET_NODE_LAYOUT, RESET_NODE_LAYOUTS.  
- **Other:** OPEN_IN_NEW_TAB, NOTIFY (outbound), TAGS_UPDATED (outbound).

---

## Router Init

```ts
initMessaging():
  createMessageRouter()
    .merge(outboundOnlyHandlers)
    .merge(navigationHandlers)
    .merge(tabHandlers)
    .merge(settingsHandlers)
    .merge(contentHandlers)
    .merge(treeHandlers)
    .merge(commandHandlers)
    .merge(pinHandlers)
    .merge(tagHandlers)
    .merge(tagDefHandlers)
    .listen()
```

- `listen()` registers `chrome.runtime.onMessage.addListener`; `dispatch(message, sender)` looks up handler by `message.type`, runs it, returns response or err.

---

## Helpers (messages.ts)

- `ok(data?)`, `err(message)` for responses.  
- `msg.navigateTo(...)`, `msg.getTree()`, etc. — factory functions for requests.  
- `defineHandlers({ ... })` returns the map for merge.

---

## AI Agent Notes

- Add new message: add `MSG.NEW_TYPE`, add request/response types and `ResponseDataByType`, add handler in appropriate handlers file, merge in router, call from sidepanel via sendMessage wrapper.
- Sender: use `chrome.runtime.sendMessage(msg.xyz(...))` from sidepanel; await response for request/response. For outbound, background may use `chrome.runtime.sendMessage` to sidepanel or tabs.
- Content script: content-handlers run in content context; use for page-specific actions; messaging from content to background uses same router when message is received by extension.
