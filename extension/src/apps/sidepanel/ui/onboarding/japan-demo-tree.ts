/**
 * Demo tree fixture — a realistic "Trip to Japan" research session.
 * Exposed as a `TrailExportBundle` so we reuse the existing IMPORT_TRAIL
 * path in the background: load it through `importTrail()` like any export.
 */

import type { TrailExportBundle } from "@shared/types/export.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import {
  type NodeId,
  type Url,
  type Title,
  type FaviconUrl,
  type Timestamp,
  now,
} from "@shared/types/ids.js";
import { uuidv7 } from "@shared/lib/uuid.js";

type NodeSeed = {
  title: string;
  url: string;
  pinned?: boolean;
  children?: NodeSeed[];
};

function nextId(): NodeId {
  // All NodeIds — including synthetic demo-tree ones — are uuidv7.
  return uuidv7() as NodeId;
}

function favicon(url: string): FaviconUrl | undefined {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64` as FaviconUrl;
  } catch {
    return undefined;
  }
}

function toNode(seed: NodeSeed): NavigationNodeJSON {
  const node: NavigationNodeJSON = {
    id: nextId(),
    timestamp: now() as Timestamp,
    data: {
      url: seed.url as Url,
      title: seed.title as Title,
      pinned: Boolean(seed.pinned),
      tags: [],
      ...(favicon(seed.url) ? { favicon: favicon(seed.url) } : {}),
    },
    children: (seed.children ?? []).map(toNode),
  };
  return node;
}

const SEED: NodeSeed = {
  title: "Planning a trip to Japan 🇯🇵",
  url: "https://www.google.com/search?q=japan+trip+planning+2026",
  children: [
    {
      title: "Flights",
      url: "https://www.google.com/travel/flights",
      children: [
        {
          title: "SFO → NRT, April 2026 · Google Flights",
          url: "https://www.google.com/travel/flights?q=SFO+to+NRT+April+2026",
        },
        {
          title: "United 837 nonstop — $1,120",
          url: "https://www.united.com/en/us/flights",
        },
        {
          title: "ANA vs JAL — which is better? (Reddit)",
          url: "https://www.reddit.com/r/JapanTravel/comments/ana_vs_jal/",
        },
      ],
    },
    {
      title: "Stay",
      url: "https://www.airbnb.com/s/Japan",
      pinned: true,
      children: [
        {
          title: "Shibuya apartment · Airbnb",
          url: "https://www.airbnb.com/rooms/shibuya-apartment",
          pinned: true,
        },
        {
          title: "Ryokan recommendations Kyoto (Reddit)",
          url: "https://www.reddit.com/r/JapanTravel/comments/kyoto_ryokan/",
        },
        {
          title: "Hotel Granvia Osaka",
          url: "https://www.granvia-osaka.jp/en/",
        },
      ],
    },
    {
      title: "Getting around",
      url: "https://www.japan-guide.com/e/e2018.html",
      children: [
        {
          title: "JR Pass — is it still worth it in 2026?",
          url: "https://www.japan-guide.com/e/e2361.html",
          pinned: true,
        },
        {
          title: "Suica vs Pasmo IC cards",
          url: "https://www.tokyo-tourism.jp/en/plan/suica-pasmo/",
        },
        {
          title: "Google Maps — Tokyo Metro routing",
          url: "https://www.google.com/maps/place/Tokyo",
        },
      ],
    },
    {
      title: "Places to visit",
      url: "https://www.lonelyplanet.com/japan",
      children: [
        {
          title: "Tokyo",
          url: "https://www.lonelyplanet.com/japan/tokyo",
          children: [
            {
              title: "Shibuya Crossing",
              url: "https://en.wikipedia.org/wiki/Shibuya_Crossing",
            },
            {
              title: "Meiji Shrine walking tour",
              url: "https://www.meijijingu.or.jp/en/",
            },
            {
              title: "TeamLab Planets — tickets",
              url: "https://www.teamlab.art/e/planets/",
              pinned: true,
            },
            {
              title: "Shinjuku Gyoen National Garden",
              url: "https://www.env.go.jp/garden/shinjukugyoen/english/",
            },
          ],
        },
        {
          title: "Kyoto",
          url: "https://www.lonelyplanet.com/japan/kyoto",
          children: [
            {
              title: "Fushimi Inari — best time to avoid crowds",
              url: "https://www.reddit.com/r/Kyoto/comments/fushimi_inari_crowds/",
            },
            {
              title: "Kinkaku-ji (Golden Pavilion)",
              url: "https://en.wikipedia.org/wiki/Kinkaku-ji",
            },
            {
              title: "Arashiyama bamboo grove + monkey park",
              url: "https://www.japan-guide.com/e/e3912.html",
            },
            {
              title: "Gion district evening walk",
              url: "https://kyoto.travel/en/see-and-do/gion",
            },
          ],
        },
        {
          title: "Osaka",
          url: "https://www.lonelyplanet.com/japan/kansai/osaka",
          children: [
            {
              title: "Osaka Castle",
              url: "https://www.osakacastle.net/english/",
            },
            {
              title: "Dotonbori food tour",
              url: "https://www.tripadvisor.com/dotonbori-food-tour",
            },
          ],
        },
      ],
    },
    {
      title: "Food to try",
      url: "https://www.seriouseats.com/japanese-food",
      children: [
        {
          title: "Best ramen in Tokyo (Reddit)",
          url: "https://www.reddit.com/r/tokyo/comments/best_ramen_tokyo/",
        },
        {
          title: "Tsukiji Outer Market guide",
          url: "https://www.tsukiji.or.jp/english/",
        },
        {
          title: "Kaiseki dinner experience — booking",
          url: "https://www.kiku-zushi.co.jp/en/",
        },
      ],
    },
    {
      title: "Budget & money",
      url: "https://www.numbeo.com/cost-of-living/country_result.jsp?country=Japan",
      children: [
        {
          title: "Average daily cost — Japan 2026",
          url: "https://www.budgetyourtrip.com/japan",
        },
        {
          title: "Currency exchange tips (Wise blog)",
          url: "https://wise.com/us/blog/exchange-currency-japan",
        },
      ],
    },
  ],
};

function countNodes(node: NavigationNodeJSON): number {
  return 1 + node.children.reduce((s, c) => s + countNodes(c), 0);
}

/**
 * Build a fresh demo bundle. Node IDs are uuidv7; the background
 * `importTrail` handler is free to remap them on import to avoid
 * collisions with the user's existing tree (time-ordered uuidv7
 * makes this a no-op in practice).
 */
export function buildJapanDemoBundle(): TrailExportBundle {
  const root = toNode(SEED);
  return {
    schema: "trail.export.v1",
    exportedAt: Date.now(),
    source: {
      treeLabel: "Trip to Japan (demo)",
      origin: "extension",
    },
    tree: {
      root,
      currentNodeId: root.id,
      nodeCount: countNodes(root),
    },
    meta: {
      nodeCount: countNodes(root),
    },
  };
}
