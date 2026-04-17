import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { NodeId, TabId } from "@shared/types/ids.js";
import type { Settings } from "@shared/types/settings.js";
import type { ResolvedFlags } from "@shared/types/flags.js";
import type { TreeUpdatedInput } from "@shared/rpc/contracts.js";
import type { Tab } from "./mocks/webext";

const nid = (n: number) => n as NodeId;
const ts = Date.now();

export function fakeTree(): NavigationTreeJSON {
  return {
    root: {
      id: nid(1),
      timestamp: ts as never,
      data: {
        url: "https://news.ycombinator.com/" as never,
        title: "Hacker News" as never,
        favicon: "https://news.ycombinator.com/favicon.ico" as never,
        pinned: false,
        tags: [],
      },
      children: [
        {
          id: nid(2),
          timestamp: ts as never,
          data: {
            url: "https://news.ycombinator.com/item?id=42" as never,
            title: "Ask HN: What are you working on?" as never,
            favicon: "https://news.ycombinator.com/favicon.ico" as never,
            pinned: false,
            tags: [],
          },
          children: [
            {
              id: nid(3),
              timestamp: ts as never,
              data: {
                url: "https://github.com/example/repo" as never,
                title: "example/repo — a side project" as never,
                favicon: "https://github.com/favicon.ico" as never,
                pinned: true,
                tags: [],
              },
              children: [],
            },
          ],
        },
        {
          id: nid(4),
          timestamp: ts as never,
          data: {
            url: "https://tailwindcss.com/docs" as never,
            title: "Tailwind CSS Docs" as never,
            favicon: "https://tailwindcss.com/favicon.ico" as never,
            pinned: false,
            tags: [],
          },
          children: [
            {
              id: nid(5),
              timestamp: ts as never,
              data: {
                url: "https://ui.shadcn.com/docs" as never,
                title: "shadcn/ui" as never,
                favicon: "https://ui.shadcn.com/favicon.ico" as never,
                pinned: true,
                tags: [],
              },
              children: [],
            },
            {
              id: nid(6),
              timestamp: ts as never,
              data: {
                url: "https://radix-ui.com/primitives/docs/components/popover" as never,
                title:
                  "Radix Primitives · Popover — A floating window that can be opened from anywhere" as never,
                favicon: "https://radix-ui.com/favicon.ico" as never,
                pinned: true,
                tags: [],
              },
              children: [],
            },
          ],
        },
      ],
    },
    currentNodeId: nid(3),
    nodeCount: 6,
  };
}

export function fakeSettings(): Settings {
  return {
    theme: "zinc" as never,
    customTheme: {
      enabled: false,
      dots: [],
      harmony: "floating",
      lightness: 0.5,
      opacity: 1,
      texture: 0,
      customColors: [],
      accentColor: null,
    },
    layout: {
      mode: "tree",
      tree: { verticalGapScale: 1, horizontalGapScale: 1, hideRoot: false },
      mindmap: { verticalGapScale: 1, horizontalGapScale: 1 },
    },
    titleTruncation: "end",
    graphDensity: "comfortable",
    showFavicons: true,
    showUrls: true,
    showTagDots: false,
    showTabCounts: true,
    showAudioIndicators: true,
    showConnections: true,
    dimClosedNodes: true,
    confirmNewTree: false,
    shortcutsEnabled: true,
    adaptivePerformance: true,
    keepTabsOnSwitch: true,
    privacy: { blocklist: [], skipIncognito: true },
    cleanup: {
      glance: { enabled: true, thresholdMs: 5000 },
      roundTrip: { enabled: true },
      allowDomains: [],
    },
  };
}

export function fakeFlags(): ResolvedFlags {
  return {} as ResolvedFlags;
}

export function fakeTreeUpdatedInput(): TreeUpdatedInput {
  const nodeIds: NodeId[] = [nid(1), nid(2), nid(3), nid(4), nid(5), nid(6)];
  return {
    tree: fakeTree(),
    reason: "tree-reset",
    tabStates: {} as never,
    nodeTabCounts: { [nid(3)]: 2, [nid(2)]: 1 } as never,
    nodeRecency: {} as never,
    openNodeIds: [nid(3)],
    commandState: { busy: false, operations: {} } as never,
    editorMode: { active: false, treeId: null },
    positions: null,
    // Silence unused hint
    _nodeIds: nodeIds,
  } as unknown as TreeUpdatedInput;
}

export function fakeTabs(nodeId: NodeId): Tab[] {
  // Node 3 pretends to have two open tabs; others have one.
  if (Number(nodeId) === 3) {
    return [
      {
        id: 101 as unknown as TabId,
        title: "example/repo — a side project",
        url: "https://github.com/example/repo",
        mutedInfo: { muted: false, reason: "user" },
      },
      {
        id: 102 as unknown as TabId,
        title: "example/repo — Pull requests",
        url: "https://github.com/example/repo/pulls",
        mutedInfo: { muted: true, reason: "user" },
      },
    ];
  }
  if (Number(nodeId) === 2) {
    return [
      {
        id: 103 as unknown as TabId,
        title: "Ask HN: What are you working on?",
        url: "https://news.ycombinator.com/item?id=42",
        mutedInfo: { muted: false, reason: "user" },
      },
    ];
  }
  return [];
}
