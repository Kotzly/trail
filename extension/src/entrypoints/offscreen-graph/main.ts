// ---------------------------------------------------------------------------
// Offscreen Graph Layout Pre-computer
//
// Runs in chrome.offscreen document. Listens for TREE_UPDATED broadcasts,
// pre-computes graph layout positions, and stores them in
// chrome.storage.session so that visible entry points (newtab, spotlight,
// sidepanel) can skip the expensive layout computation on load.
// ---------------------------------------------------------------------------

import { computeLayoutFromTree } from "@shared/graph-layout-cache/compute-layout.js";
import { writeLayoutCache } from "@shared/graph-layout-cache/cache.js";
import { sendRpcMessage } from "@shared/rpc/client.js";
import { rpc } from "@shared/rpc/contracts.js";
import type { Settings } from "@shared/types/settings.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { NodeId } from "@shared/types/ids.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let cachedSettings: Settings | null = null;
let cachedTreeJSON: NavigationTreeJSON | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

const DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function fetchSettings(): Promise<void> {
  try {
    const response = await sendRpcMessage(rpc.getSettings());
    if (response.success) {
      cachedSettings = response.data as Settings;
    }
  } catch {
    // Settings unavailable — use defaults
  }
}

// ---------------------------------------------------------------------------
// Layout computation
// ---------------------------------------------------------------------------

const ACTIVE_TREE_KEY = "active";

async function computeAndCache(
  treeJSON: NavigationTreeJSON,
  collapsedNodeIds?: ReadonlySet<NodeId>,
): Promise<void> {
  try {
    const result = computeLayoutFromTree(
      treeJSON,
      ACTIVE_TREE_KEY,
      cachedSettings,
      collapsedNodeIds,
      false,
    );
    if (result) {
      await writeLayoutCache(result);
      console.debug(
        `[offscreen-graph] layout cached (${result.nodeCount} nodes, mode=${result.layoutMode})`,
      );
    }
  } catch (err) {
    console.warn("[offscreen-graph] layout computation failed:", err);
  }
}

function scheduleCompute(
  treeJSON: NavigationTreeJSON,
  collapsedNodeIds?: ReadonlySet<NodeId>,
): void {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void computeAndCache(treeJSON, collapsedNodeIds), DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!message || typeof message !== "object") return;

  const msg = message as Record<string, unknown>;

  // TREE_UPDATED — sent as raw RequestMessage { type: 'TREE_UPDATED', tree: ..., ... }
  if (msg.type === "TREE_UPDATED") {
    const tree = msg.tree as NavigationTreeJSON | undefined;
    const collapsedIds = msg.collapsedNodeIds as NodeId[] | undefined;
    if (tree) {
      cachedTreeJSON = tree;
      scheduleCompute(tree, collapsedIds ? new Set(collapsedIds) : undefined);
    }
  }

  // SAVE_SETTINGS — settings changed, refetch and recompute layout immediately
  if (msg.type === "SAVE_SETTINGS") {
    void (async () => {
      await fetchSettings();
      if (cachedTreeJSON) {
        await computeAndCache(cachedTreeJSON);
      }
    })();
  }
});

// ---------------------------------------------------------------------------
// Bootstrap — fetch settings + compute initial layout
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  await fetchSettings();

  // Fetch the current active tree and pre-compute layout immediately
  try {
    const response = await sendRpcMessage(rpc.getTree());
    if (response.success) {
      const data = response.data as { tree?: NavigationTreeJSON };
      if (data.tree) {
        cachedTreeJSON = data.tree;
        await computeAndCache(data.tree);
      }
    }
  } catch {
    // Tree not available yet — will be computed on first TREE_UPDATED
  }

  console.debug("[offscreen-graph] ready");
}

void bootstrap();
