/**
 * Thin aggregator: stitches the four cohesive tree-handler modules
 * back into a single `treeHandlers` object so the proxy-service
 * registration (and any existing tests) don't need to change.
 *
 * Direct callers should prefer importing the focused module they
 * need:
 *   - tree-lifecycle-handlers.ts (create/rename/delete/restore tree)
 *   - node-delete-handlers.ts    (DELETE_*, BULK_DELETE_*)
 *   - node-layout-handlers.ts    (SET_NODE_LAYOUT*, RESET_NODE_LAYOUTS)
 *   - snapshots.ts               (snapshot/build helpers shared by the
 *                                 above)
 */

import { treeLifecycleHandlers } from "./tree-lifecycle-handlers.js";
import { nodeDeleteHandlers } from "./node-delete-handlers.js";
import { nodeLayoutHandlers } from "./node-layout-handlers.js";

export const treeHandlers = {
  ...treeLifecycleHandlers,
  ...nodeDeleteHandlers,
  ...nodeLayoutHandlers,
};
