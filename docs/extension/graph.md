# Extension: Graph (Pixi Renderer & Layout)

**Scope:** `extension/` — sidepanel navigation tree visualization  
**Purpose:** Render tree nodes (favicon, title, URL, tags, tab count, audio/pin) with LOD, pan/zoom, and layout modes (tree, mindmap, radial).

---

## File Map

| Role | Path |
|------|------|
| Pixi renderer | `extension/src/sidepanel/ui/graph/render/GraphPixiRenderer.ts` |
| Render types | `extension/src/sidepanel/ui/graph/render/types.ts` |
| Graph theme (CSS vars → colors) | `extension/src/sidepanel/ui/graph/render/theme.ts` |
| Spatial index (hit-test) | `extension/src/sidepanel/ui/graph/render/spatial-index.ts` |
| Graph types (layout, view) | `extension/src/sidepanel/ui/graph/types.ts` |
| Layout calculator | `extension/src/sidepanel/ui/graph/layout/calculator.ts` |
| Layout config | `extension/src/sidepanel/ui/graph/layout/config.ts` |
| Graph area (canvas wrapper) | `extension/src/sidepanel/ui/components/graph/GraphArea.tsx` |
| Graph canvas (Pixi app) | `extension/src/sidepanel/ui/components/graph/GraphCanvas.tsx` |

---

## Interfaces

### NodeRenderModel (render/types.ts)

```ts
type GraphDisplayOptions = {
  titleTruncation: 'start' | 'middle' | 'end';
  showFavicons: boolean;
  showUrls: boolean;
  showTagDots: boolean;
  showTabCounts: boolean;
  showAudioIndicators: boolean;
  dimClosedNodes: boolean;
};

type NodeRenderModel = {
  id: NodeId;
  node: NavigationNode;
  x: number; y: number;
  width: number; height: number;
  isCurrent: boolean;
  isOpen: boolean;
  openProgress: number;
  tabCount: number;
  tabState?: TabState;
  isCollapsed: boolean;
  isSelected: boolean;
  isPreview: boolean;
  isSearchMatch: boolean;
  isSearchFocused: boolean;
  isSearchDimmed: boolean;
  isHoverFocused: boolean;
  display: GraphDisplayOptions;
  tagDefs: Record<string, TagDefinition>;
};

type ConnectionSegment = {
  id: string;
  start: { x, y }; cp1: { x, y }; cp2: { x, y }; end: { x, y };
  onPath: boolean;
  bounds: { minX, minY, maxX, maxY };
};

type ParticleRenderModel = { id: string; x: number; y: number; radius: number; alpha: number; };
```

### Layout & View (graph/types.ts)

```ts
type LayoutMode = 'tree' | 'mindmap' | 'radial';

interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  verticalGap: number;
  horizontalGap: number;
}

interface ViewState {
  translateX: number;
  translateY: number;
  scale: number;
}

interface GraphAPI {
  centerOnNode: (nodeId: NodeId, animate?: boolean) => void;
  fitToView: (animate?: boolean) => void;
  wrapper: HTMLElement;
}
```

---

## Design Patterns

1. **LOD (Level of Detail)**  
   `resolveNodeLod(model, view, detailMode)` → `'hidden' | 'dot' | 'low' | 'full'`. Thresholds: &lt;6px hidden, &lt;14px dot, &lt;28px low. Current/selected/search-focused/hover always full. `detailMode` from settings can force low or dot.

2. **NodeVisual class**  
   One PIXI.Container per node; background, favicon, title/URL text, tab badge, pin/audio icons, collapse badge, tag dots. State key (lod, styleKey, textKey, tagKey, faviconKey, themeVersion, openProgress) drives minimal redraw.

3. **Favicon cache**  
   `faviconTextureCache` and `faviconLoadPromises` keyed by `FaviconUrl`; load once and reuse PIXI.Texture.

4. **Connections**  
   Bezier segments between nodes; rendered with `onPath` and bounds for culling.

5. **Theme**  
   `readGraphTheme()` returns colors from CSS vars (e.g. `--graph-node-active-bg`, `--graph-node-closed-title`). Renderer uses these for fills/strokes and invalidates on theme change.

6. **Spatial index**  
   `SpatialIndex` for hit-testing and visible-node queries; updated when layout or view changes.

---

## Layout

- **Tree / Mindmap / Radial:** Layout calculator consumes `LayoutConfig` (or radial params), node tree, and open state; outputs `NodePosition[]` and connection segments.
- **LayoutConfig** comes from settings: `verticalGapScale`, `horizontalGapScale`, `hideRoot`, and mode-specific params (radial: `angleWeightExp`, `minSpanFactor`, etc.).

---

## Render Pipeline

1. **Input:** `RenderData`: `nodes` (NodeRenderModel[]), `connections`, `nodeWidth`/`nodeHeight`, `showConnections`, `particles`.
2. **Per node:** LOD → create/update NodeVisual (background, text, favicon, badges, tag dots). Lucide icons (ChevronDown, Pin, Volume2, VolumeX) rendered as SVG strings → PIXI.
3. **Connections:** Drawn with Graphics; optional culling by viewport.
4. **Particles:** Optional decorative particles.
5. **Invalidation:** When theme version, open progress, or display options change, only affected NodeVisuals update.

---

## Constants (GraphPixiRenderer)

- NODE_RADIUS 22, NODE_PADDING_X 12, NODE_PADDING_Y 8, NODE_GAP 10.
- FAVICON_SIZE 28, TITLE_FONT_SIZE 12, URL_FONT_SIZE 10.
- LOD_HIDE_PX 6, LOD_DOT_PX 14, LOD_LOW_PX 28.

---

## AI Agent Notes

- Add new node decoration: extend NodeVisual (new Graphics/Container), add to state key if needed, update `updateNode` branch.
- New layout mode: extend LayoutMode, add config in settings, implement in layout calculator and pass through to renderer.
- Graph theme tokens are defined in theme-generator (THEME_TOKEN_KEYS) and read in graph/render/theme.ts.
