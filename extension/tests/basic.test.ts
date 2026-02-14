import assert from 'node:assert/strict';

import type { NodeData, NavigationNodeJSON } from '../src/shared/types/node.js';
import type { Description, NodeId, Timestamp, Url, Title } from '../src/shared/types/ids.js';
import type { NavigationTreeJSON } from '../src/shared/types/tree.js';
import { NavigationTree } from '../src/background/state/nav-tree.js';
import { CommandManager } from '../src/shared/lib/commands.js';
import type { LayoutConfig, RadialLayoutConfig } from '../src/sidepanel/ui/graph/types.js';
import type { ViewState } from '../src/sidepanel/ui/graph/types.js';
import {
  calculateLayout,
  calculateMindmapLayout,
  calculateRadialLayout,
  getCanvasBounds,
} from '../src/sidepanel/ui/graph/layout/calculator.js';
import { computeGraphGridTransform } from '../src/sidepanel/ui/components/graph/grid-transform.js';
import { getSidebarLabelState, getSidebarWidth } from '../src/sidepanel/ui/components/ui/sidebar-utils.js';
import {
  DEFAULT_BACKEND_CONFIG,
  getBackendServerPreset,
  resolveBackendConfig,
  resolvePresetOverride,
} from '../src/shared/config/backend.js';
import { getFeatureAccess } from '../src/shared/lib/entitlements.js';
import {
  createQualityPolicyState,
  updateQualityPolicy,
} from '../src/sidepanel/ui/graph/render/quality-policy.js';
import { decideViewInvalidation } from '../src/sidepanel/ui/graph/render/view-invalidation.js';
import { RPC_METHOD, rpc } from '../src/shared/rpc/contracts.js';
import { ExtensionMessage, SiteMessage } from '../src/shared/schemas/site-messages.js';
import { isAllowedSiteOrigin } from '../src/shared/config/site-origins.js';
import {
  buildPreviewSelection,
  diffSelection,
  shouldEmitPreview,
} from '../src/sidepanel/ui/components/graph/selection-utils.js';
import { runNotificationsSonnerAdapterTests } from './notifications-sonner-adapter.test.js';

function data(url: Url, title?: Title): NodeData {
  return {
    url,
    title: (title ?? url) as Title,
    pinned: false,
    tags: [],
  };
}

function testNavigationTreeDeletion(): void {
  const tree = new NavigationTree();
  const root = tree.navigate(data('https://root.test' as Url));
  const child = tree.navigate(data('https://child.test' as Url));
  tree.setCurrent(root);
  const sibling = tree.navigate(data('https://sibling.test' as Url));
  tree.setCurrent(child);
  const grand = tree.navigate(data('https://grand.test' as Url));

  const removed = tree.deleteNode(child.id);
  assert.equal(removed.removed.length, 1);
  assert.equal(tree.findNodeById(child.id), null);
  assert.equal(tree.findNodeById(grand.id)?.getParent()?.id, root.id);

  const removedChildren = tree.deleteChildren(root.id);
  assert.equal(removedChildren.length, 2);
  assert.equal(tree.findNodeById(sibling.id), null);
  assert.equal(tree.findNodeById(grand.id), null);
  assert.equal(tree.size(), 1);
}

function testNavigationTreeDeleteMergesDuplicateReparentedNodes(): void {
  const tree = new NavigationTree();
  const root = tree.navigate(data('https://root.test' as Url));
  const link1 = tree.navigate(data('https://example.com/auth' as Url));
  const link2a = tree.navigate(data('https://example.com/account/' as Url));

  tree.setCurrent(root);
  const link2b = tree.navigate(data('https://example.com/account' as Url));

  // Sanity: link2a is under link1, link2b is direct child of root.
  assert.equal(link2a.getParent()?.id, link1.id);
  assert.equal(link2b.getParent()?.id, root.id);

  const result = tree.deleteNode(link1.id);
  assert.equal(result.removed.length, 1);

  const directAccountChildren = root
    .getChildren()
    .filter((node) => node.data.url.toString().includes('example.com/account'));

  assert.equal(directAccountChildren.length, 1);

  // The reparented duplicate should have been merged away.
  assert.equal(tree.findNodeById(link2a.id), null);
}

function testNavigationTreeSubtree(): void {
  const tree = new NavigationTree();
  const root = tree.navigate(data('https://root.test' as Url));
  const child = tree.navigate(data('https://child.test' as Url));
  const grand = tree.navigate(data('https://grand.test' as Url));

  const removed = tree.deleteSubtree(child.id);
  assert.equal(removed.length, 2);
  assert.equal(tree.findNodeById(child.id), null);
  assert.equal(tree.findNodeById(grand.id), null);
  assert.equal(tree.size(), 1);
  assert.equal(tree.findNodeById(root.id), root);
}

function testCommandManagerUndoRedo(): void {
  CommandManager.clearHistory();

  const rootNode: NavigationNodeJSON = {
    id: 1 as NodeId,
    timestamp: 1 as Timestamp,
    data: data('https://root.test'),
    children: [],
  };

  const snapshot1: NavigationTreeJSON = {
    root: rootNode,
    currentNodeId: rootNode.id,
    nodeCount: 1,
  };

  const childNode: NavigationNodeJSON = {
    id: 2 as NodeId,
    timestamp: 2 as Timestamp,
    data: data('https://child.test'),
    children: [],
  };

  const snapshot2: NavigationTreeJSON = {
    root: {
      ...rootNode,
      children: [childNode],
    },
    currentNodeId: childNode.id,
    nodeCount: 2,
  };

  CommandManager.saveSnapshot(snapshot1, 'snapshot-1' as Description);

  const undoState = CommandManager.undo(snapshot2);
  assert.ok(undoState);
  assert.equal(undoState!.nodeCount, 1);
  assert.equal(undoState!.root?.children.length, 0);

  const redoState = CommandManager.redo(undoState!);
  assert.ok(redoState);
  assert.equal(redoState!.nodeCount, 2);
  assert.equal(redoState!.root?.children.length, 1);
}

function testNavigationTreeSearchIndex(): void {
  const tree = new NavigationTree();
  const root = tree.navigate(data('https://example.com/root' as Url, 'Root Page' as Title));
  const child = tree.navigate(data('https://docs.example.com/guide' as Url, 'Guide' as Title));
  tree.setCurrent(root);
  const other = tree.navigate(data('https://other.test/path' as Url, 'Other Site' as Title));

  const titleMatches = tree.findNodesByQuery('guide');
  assert.ok(titleMatches.includes(child.id));

  const domainMatches = tree.findNodesByQuery('example.com');
  assert.ok(domainMatches.includes(root.id));
  assert.ok(domainMatches.includes(child.id));

  const multiTermMatches = tree.findNodesByQuery('other path');
  assert.equal(multiTermMatches.length, 1);
  assert.ok(multiTermMatches.includes(other.id));

  const updated = tree.navigate(data('https://other.test/path', 'Renamed'));
  const renameMatches = tree.findNodesByQuery('renamed');
  assert.ok(renameMatches.includes(updated.id));
}

function testNavigationTreeHasNoCapacityApi(): void {
  const tree = new NavigationTree();
  const treeWithLegacyApi = tree as unknown as { getCapacity?: unknown; setCapacity?: unknown };
  assert.equal(typeof treeWithLegacyApi.getCapacity, 'undefined');
  assert.equal(typeof treeWithLegacyApi.setCapacity, 'undefined');
}

function testGraphLayouts(): void {
  const tree = new NavigationTree();
  const root = tree.navigate(data('https://root.test'));
  const child = tree.navigate(data('https://child.test'));
  tree.setCurrent(root);
  const sibling = tree.navigate(data('https://sibling.test'));

  const layoutConfig: LayoutConfig = {
    nodeWidth: 120,
    nodeHeight: 60,
    verticalGap: 40,
    horizontalGap: 20,
  };
  const radialConfig: RadialLayoutConfig = {
    angleWeightExp: 0.6,
    minSpanFactor: 0.6,
    minSpanAbs: 0.12,
    requiredScale: 0.6,
    depthGapBase: 70,
    depthGapGrowth: 0.1,
    effectiveWidth: layoutConfig.nodeWidth + layoutConfig.horizontalGap,
  };

  const treeLayout = calculateLayout(root, layoutConfig);
  assert.equal(treeLayout.positions.size, 3);
  const treeBounds = getCanvasBounds(treeLayout.positions, layoutConfig.nodeWidth, layoutConfig.nodeHeight);
  assert.ok(treeBounds.width >= layoutConfig.nodeWidth);
  assert.ok(treeBounds.height >= layoutConfig.nodeHeight);

  const mindmapLayout = calculateMindmapLayout(root, layoutConfig);
  assert.equal(mindmapLayout.positions.size, 3);

  const radialLayout = calculateRadialLayout(root, radialConfig, layoutConfig);
  assert.equal(radialLayout.positions.size, 3);
  assert.ok(radialLayout.width > 0);
}

function testGraphGridTransform(): void {
  const baseView: ViewState = { translateX: 0, translateY: 0, scale: 1 };
  const base = computeGraphGridTransform(baseView);
  assert.equal(base.size, 20);
  assert.equal(base.dotSize, 1.5);
  assert.equal(base.offsetX, 0);
  assert.equal(base.offsetY, 0);

  const movedView: ViewState = { translateX: 25, translateY: -5, scale: 2 };
  const moved = computeGraphGridTransform(movedView);
  assert.equal(moved.size, 40);
  assert.equal(moved.dotSize, 3);
  assert.equal(moved.offsetX, 25);
  assert.equal(moved.offsetY, 35);

  const tinyView: ViewState = { translateX: 0, translateY: 0, scale: 0.2 };
  const tiny = computeGraphGridTransform(tinyView);
  assert.equal(tiny.size, 16);
  assert.equal(tiny.dotSize, 1);
}

function testSidebarLabelState(): void {
  const openState = getSidebarLabelState(true, true);
  assert.equal(openState.display, 'inline-block');
  assert.equal(openState.opacity, 1);

  const closedState = getSidebarLabelState(false, true);
  assert.equal(closedState.display, 'none');
  assert.equal(closedState.opacity, 0);

  const staticState = getSidebarLabelState(false, false);
  assert.equal(staticState.display, 'inline-block');
  assert.equal(staticState.opacity, 1);
}

function testSidebarWidth(): void {
  assert.equal(getSidebarWidth(true, true), '180px');
  assert.equal(getSidebarWidth(false, true), '72px');
  assert.equal(getSidebarWidth(false, false), '180px');
}

function testBackendConfigOverride(): void {
  const resolved = resolveBackendConfig({
    baseUrl: 'http://localhost:3001',
    portalUrl: 'http://localhost:3001/auth/portal/complete',
    mode: 'remote',
  });

  assert.equal(DEFAULT_BACKEND_CONFIG.baseUrl, 'https://app.gettrail.net');
  assert.equal(resolved.baseUrl, 'http://localhost:3001');
  assert.equal(resolved.portalUrl, 'http://localhost:3001/auth/portal/complete');
  assert.equal(resolved.mode, 'remote');
}

function testBackendLocalPresetOverride(): void {
  const override = resolvePresetOverride('local');
  assert.ok(override);
  assert.equal(override.baseUrl, 'http://localhost:3001');
  assert.equal(override.portalUrl, 'http://localhost:3001/auth/portal/complete');
  assert.equal(override.mode, 'remote');
  assert.equal(override.env, 'local');
}

function testBackendUnknownPresetOverride(): void {
  const override = resolvePresetOverride('unknown');
  assert.equal(override, null);
}

function testBackendServerPresetResolution(): void {
  const defaultPreset = getBackendServerPreset(DEFAULT_BACKEND_CONFIG);
  assert.equal(defaultPreset, 'gettrail');

  const localOverride = resolvePresetOverride('local');
  assert.ok(localOverride);
  const localConfig = resolveBackendConfig(localOverride);
  assert.equal(getBackendServerPreset(localConfig), 'local');

  const localhostConfig = resolveBackendConfig({
    baseUrl: 'http://localhost:3001',
    portalUrl: 'http://localhost:3001/auth/portal/complete',
  });
  assert.equal(getBackendServerPreset(localhostConfig), 'local');
}

function testEntitlements(): void {
  const proAccess = getFeatureAccess({
    config: { 'feature.trailsSync.minTier': 'pro' },
    subscription: {
      id: 'sub_1',
      planId: 'pro',
      status: 'active',
      interval: 'month',
      currentPeriodStart: '2026-02-01T00:00:00.000Z',
      currentPeriodEnd: '2026-03-01T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      canceledAt: null,
    },
    featureKey: 'trailsSync',
  });

  assert.equal(proAccess.allowed, true);
  assert.equal(proAccess.currentTier, 'pro');
  assert.equal(proAccess.requiredTier, 'pro');

  const teamAccess = getFeatureAccess({
    config: { 'feature.trailsSync.minTier': 'teams' },
    subscription: {
      id: 'sub_2',
      planId: 'pro',
      status: 'active',
      interval: 'month',
      currentPeriodStart: '2026-02-01T00:00:00.000Z',
      currentPeriodEnd: '2026-03-01T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      canceledAt: null,
    },
    featureKey: 'trailsSync',
  });

  assert.equal(teamAccess.allowed, false);
  assert.equal(teamAccess.currentTier, 'pro');
  assert.equal(teamAccess.requiredTier, 'teams');
}

function testQualityPolicyTransitions(): void {
  let now = 1_000;
  let state = createQualityPolicyState(now);

  for (let i = 0; i < 30; i += 1) {
    now += 100;
    const next = updateQualityPolicy(
      state,
      {
        frameMs: 36,
        updateVisibleMs: 12,
        connectionsMs: 8,
        renderMs: 12,
        visibleNodes: 1000,
        visibleConnections: 1200,
      },
      now,
    );
    state = next.state;
  }

  assert.ok(state.level === 'low' || state.level === 'dot');

  for (let i = 0; i < 90; i += 1) {
    now += 120;
    const next = updateQualityPolicy(
      state,
      {
        frameMs: 10,
        updateVisibleMs: 3,
        connectionsMs: 2,
        renderMs: 3,
        visibleNodes: 120,
        visibleConnections: 180,
      },
      now,
    );
    state = next.state;
  }

  assert.notEqual(state.level, 'dot');
}

function testViewInvalidationDecisions(): void {
  const prev = { translateX: 0, translateY: 0, scale: 1 };
  const cached = { minX: -200, minY: -200, maxX: 1000, maxY: 1000 };

  const translateOnly = decideViewInvalidation({
    prevView: prev,
    nextView: { translateX: -20, translateY: -10, scale: 1 },
    viewportWidth: 600,
    viewportHeight: 400,
    cachedCullingRect: cached,
  });
  assert.equal(translateOnly.decision, 'translate-only');

  const scaled = decideViewInvalidation({
    prevView: prev,
    nextView: { translateX: -20, translateY: -10, scale: 1.1 },
    viewportWidth: 600,
    viewportHeight: 400,
    cachedCullingRect: cached,
  });
  assert.equal(scaled.decision, 'full');

  const outOfBounds = decideViewInvalidation({
    prevView: prev,
    nextView: { translateX: -2000, translateY: -1200, scale: 1 },
    viewportWidth: 600,
    viewportHeight: 400,
    cachedCullingRect: cached,
  });
  assert.equal(outOfBounds.decision, 'full');
}

function testSetNodeLayoutBatchMessage(): void {
  const request = rpc.setNodeLayoutBatch({
    layouts: [
      { nodeId: 1 as NodeId, offsetX: 10, offsetY: -5 },
      { nodeId: 2 as NodeId, radial: { angleDelta: 0.5, radiusDelta: 20 } },
    ],
  });

  assert.equal(request.type, RPC_METHOD.SET_NODE_LAYOUT_BATCH);
  assert.equal(request.layouts.length, 2);
}

function testSaveCancelProtocolSchemas(): void {
  const save = SiteMessage.parse({
    source: 'trail-site',
    type: 'SAVE_EDITOR_MODE',
    requestId: '11111111-1111-4111-8111-111111111111',
    timestamp: Date.now(),
  });
  assert.equal(save.type, 'SAVE_EDITOR_MODE');

  const cancel = SiteMessage.parse({
    source: 'trail-site',
    type: 'CANCEL_EDITOR_MODE',
    requestId: '22222222-2222-4222-8222-222222222222',
    timestamp: Date.now(),
  });
  assert.equal(cancel.type, 'CANCEL_EDITOR_MODE');

  const saveAck = ExtensionMessage.parse({
    source: 'trail-extension',
    type: 'EDITOR_MODE_SAVED',
    requestId: '33333333-3333-4333-8333-333333333333',
    timestamp: Date.now(),
    ok: false,
    error: 'sync failed',
  });
  assert.equal(saveAck.type, 'EDITOR_MODE_SAVED');
  assert.equal(saveAck.ok, false);

  const cancelAck = ExtensionMessage.parse({
    source: 'trail-extension',
    type: 'EDITOR_MODE_CANCELLED',
    requestId: '44444444-4444-4444-8444-444444444444',
    timestamp: Date.now(),
    ok: true,
  });
  assert.equal(cancelAck.type, 'EDITOR_MODE_CANCELLED');
  assert.equal(cancelAck.ok, true);
}

function testAuthBridgeProtocolSchemas(): void {
  const request = SiteMessage.parse({
    source: 'trail-site',
    type: 'REQUEST_AUTH_BRIDGE_CODE',
    requestId: '55555555-5555-4555-8555-555555555555',
    timestamp: Date.now(),
  });
  assert.equal(request.type, 'REQUEST_AUTH_BRIDGE_CODE');

  const response = ExtensionMessage.parse({
    source: 'trail-extension',
    type: 'AUTH_BRIDGE_CODE',
    requestId: '66666666-6666-4666-8666-666666666666',
    timestamp: Date.now(),
    ok: true,
    code: 'bridge-code',
    expiresAt: '2026-02-14T12:00:00.000Z',
  });
  assert.equal(response.type, 'AUTH_BRIDGE_CODE');
  assert.equal(response.ok, true);

  const revokedAck = ExtensionMessage.parse({
    source: 'trail-extension',
    type: 'AUTH_REVOKED_ACK',
    requestId: '77777777-7777-4777-8777-777777777777',
    timestamp: Date.now(),
    ok: true,
  });
  assert.equal(revokedAck.type, 'AUTH_REVOKED_ACK');
}

function testAllowedSiteOrigins(): void {
  assert.equal(isAllowedSiteOrigin('https://gettrail.net'), true);
  assert.equal(isAllowedSiteOrigin('https://app.gettrail.net'), true);
  assert.equal(isAllowedSiteOrigin('http://localhost:3000'), true);
  assert.equal(isAllowedSiteOrigin('https://evil.com'), false);
}

function testSelectionUtilsBuildPreviewSelection(): void {
  const base = new Set<NodeId>([1 as NodeId, 2 as NodeId]);
  const hits = new Set<NodeId>([2 as NodeId, 3 as NodeId, 4 as NodeId]);
  const active = new Set<NodeId>([2 as NodeId, 3 as NodeId]);

  const add = buildPreviewSelection(base, hits, 'add', active);
  assert.deepEqual(Array.from(add).sort((a, b) => a - b), [1, 2, 3]);

  const remove = buildPreviewSelection(base, hits, 'remove', active);
  assert.deepEqual(Array.from(remove).sort((a, b) => a - b), [1]);

  const replace = buildPreviewSelection(base, hits, 'replace', active);
  assert.deepEqual(Array.from(replace).sort((a, b) => a - b), [2, 3]);
}

function testSelectionUtilsDiffSelection(): void {
  const prev = new Set<NodeId>([1 as NodeId, 2 as NodeId, 3 as NodeId]);
  const next = new Set<NodeId>([2 as NodeId, 3 as NodeId, 4 as NodeId]);

  const diff = diffSelection(prev, next);
  assert.deepEqual(Array.from(diff.added), [4]);
  assert.deepEqual(Array.from(diff.removed), [1]);
  assert.equal(diff.changedCount, 2);
}

function testSelectionUtilsShouldEmitPreview(): void {
  const a = new Set<NodeId>([1 as NodeId, 2 as NodeId]);
  const b = new Set<NodeId>([2 as NodeId, 1 as NodeId]);
  const c = new Set<NodeId>([1 as NodeId, 3 as NodeId]);

  assert.equal(shouldEmitPreview(a, b), false);
  assert.equal(shouldEmitPreview(a, c), true);
}

try {
  testNavigationTreeDeletion();
  testNavigationTreeDeleteMergesDuplicateReparentedNodes();
  testNavigationTreeSubtree();
  testCommandManagerUndoRedo();
  testNavigationTreeSearchIndex();
  testNavigationTreeHasNoCapacityApi();
  testGraphLayouts();
  testGraphGridTransform();
  testSidebarLabelState();
  testSidebarWidth();
  testBackendConfigOverride();
  testBackendLocalPresetOverride();
  testBackendUnknownPresetOverride();
  testBackendServerPresetResolution();
  testEntitlements();
  testQualityPolicyTransitions();
  testViewInvalidationDecisions();
  testSetNodeLayoutBatchMessage();
  testSaveCancelProtocolSchemas();
  testAuthBridgeProtocolSchemas();
  testAllowedSiteOrigins();
  testSelectionUtilsBuildPreviewSelection();
  testSelectionUtilsDiffSelection();
  testSelectionUtilsShouldEmitPreview();
  runNotificationsSonnerAdapterTests();
  console.log('All tests passed');
} catch (error) {
  console.error('Test failure:', error);
  process.exit(1);
}
