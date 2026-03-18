import '../pixi-no-eval-bootstrap.js';
import * as PIXI from 'pixi.js';
import { ChevronDown, Pin, Volume2, VolumeX } from 'lucide';
import type { TextStyleFontWeight } from 'pixi.js';
import type { FaviconUrl, NodeId } from '@shared/types/ids.js';
import { getFaviconUrl } from '@shared/utils/favicon.js';
import { formatUrl } from '../../shared/format.js';
import type { LayoutMode, ViewState } from '../types.js';
import type { ConnectionSegment, GraphDisplayOptions, NodeRenderModel, ParticleRenderModel } from './types.js';
import { SpatialIndex } from './spatial-index.js';
import { readGraphTheme } from './theme.js';
import {
  decideViewInvalidation,
  worldRectFromView,
  type WorldRect,
} from './view-invalidation.js';
import { diffSelection, shouldEmitPreview } from '../../components/graph/selection-utils.js';
import { hasRuntimeGetURL, runtimeGetURL } from '@shared/platform/webext.js';
import { graphProfiler } from './graph-profiler.js';
import { createGraphSnapshot, diffSnapshots, type GraphSnapshot } from './graph-snapshot.js';

type DynamicGraphState = {
  nodes: NodeRenderModel[];
  connections: ConnectionSegment[];
  showConnections: boolean;
};

type LODLevel = 'hidden' | 'dot' | 'low' | 'full';
type DetailMode = 'full' | 'low' | 'dot';
export type ConnectionQuality = 'full' | 'simplified' | 'thin';

export type GraphRenderMetrics = {
  updateVisibleMs: number;
  connectionsMs: number;
  renderMs: number;
  visibleNodes: number;
  visibleConnections: number;
  selectionQueryMs: number;
  selectionPatchMs: number;
  selectionChangedCount: number;
};

const LOD_HIDE_PX = -1; // disabled
const LOD_DOT_PX = 12;
const LOD_LOW_PX = 32;
/** Paths/connections are not drawn when typical node size on screen is below this (must be < LOD_HIDE_PX). */
const LOD_CONN_HIDE_PX = -1; // disabled

const NODE_RADIUS = 12;
const NODE_PADDING_X = 12;
const NODE_PADDING_Y = 8;
const NODE_GAP = 10;
const FAVICON_SIZE = 28;
const FAVICON_ICON = 18;

const TITLE_FONT_SIZE = 12;
const URL_FONT_SIZE = 10;

const TAB_BADGE_PADDING_X = 6;
const TAB_BADGE_PADDING_Y = 3;

const FAVICON_CACHE_MAX = 256;
const faviconTextureCache = new Map<FaviconUrl, PIXI.Texture>();
const faviconLoadPromises = new Map<FaviconUrl, Promise<PIXI.Texture | null>>();

function cacheFaviconTexture(url: FaviconUrl, texture: PIXI.Texture): void {
  if (faviconTextureCache.size >= FAVICON_CACHE_MAX) {
    const oldest = faviconTextureCache.keys().next().value;
    if (oldest !== undefined) {
      faviconTextureCache.get(oldest)?.destroy();
      faviconTextureCache.delete(oldest);
    }
  }
  faviconTextureCache.set(url, texture);
}
const STATUS_ICON_SIZE = 12;
const STATUS_ICON_STROKE = 2;
const ICON_VIEWBOX = 24;
const STATUS_ICON_SCALE = STATUS_ICON_SIZE / ICON_VIEWBOX;
const COLLAPSE_BADGE_SIZE = 18;
const COLLAPSE_BADGE_MARGIN = 8;
const COLLAPSE_ICON_SIZE = 12;
const COLLAPSE_ICON_STROKE = 2;
const COLLAPSE_ICON_SCALE = COLLAPSE_ICON_SIZE / ICON_VIEWBOX;
const COLLAPSE_ICON_NAME = 'ChevronDown';

type LucideNode = Array<[string, Record<string, string | number | undefined>]>;

const lucideIcons: Record<string, LucideNode> = {
  ChevronDown,
  Pin,
  Volume2,
  VolumeX,
};

function resolveNodeLod(
  model: NodeRenderModel,
  view: ViewState,
  detailMode: DetailMode,
  isSelected: boolean
): LODLevel {
  const scale = view.scale;
  const pixelSize = Math.min(model.width, model.height) * scale;
  const forceDetail =
    model.isCurrent || isSelected || model.isSearchFocused || model.isHoverFocused;
  let lod: LODLevel = 'full';
  if (!forceDetail && pixelSize < LOD_HIDE_PX) lod = 'hidden';
  else if (!forceDetail && pixelSize < LOD_DOT_PX) lod = 'dot';
  else if (!forceDetail && pixelSize < LOD_LOW_PX) lod = 'low';
  if (detailMode === 'low' && lod === 'full') lod = 'low';
  if (detailMode === 'dot' && lod !== 'hidden') lod = 'dot';
  return lod;
}

function getLucideSvg(iconName: string, color: number, strokeWidth: number): string | null {
  const icon = lucideIcons[iconName];
  if (!icon) return null;
  return buildLucideSvg(icon, colorToHex(color), ICON_VIEWBOX, strokeWidth);
}

function buildLucideSvg(node: LucideNode, stroke: string, size: number, strokeWidth: number) {
  const attrs = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: String(size),
    height: String(size),
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    'stroke-width': String(strokeWidth),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };
  const parts = [
    `<svg ${toAttrString(attrs)}>`,
    ...node.map(([tag, tagAttrs]) => `<${tag} ${toAttrString(tagAttrs)} />`),
    '</svg>',
  ];
  return parts.join('');
}

function toAttrString(attrs: Record<string, string | number | undefined>) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}="${escapeXml(String(value))}"`)
    .join(' ');
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function colorToHex(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function getCollapseBadgeRect(width: number, height: number) {
  const size = COLLAPSE_BADGE_SIZE;
  const x = width - size - COLLAPSE_BADGE_MARGIN;
  const y = (height - size) / 2;
  return { x, y, size };
}

type NodeVisualState = {
  lod: LODLevel;
  styleKey: string;
  textKey: string;
  tagKey: string;
  faviconKey: string;
  themeVersion: number;
  openProgress: number;
  textResolution: number;
};

class NodeVisual {
  readonly id: NodeId;
  readonly container = new PIXI.Container();
  private readonly background = new PIXI.Graphics();
  private readonly faviconBg = new PIXI.Graphics();
  private faviconSprite: PIXI.Sprite | null = null;
  private readonly titleText = new PIXI.Text({ text: '' });
  private readonly urlText = new PIXI.Text({ text: '' });
  private readonly tabBadge = new PIXI.Container();
  private readonly tabBadgeBg = new PIXI.Graphics();
  private readonly tabBadgeText = new PIXI.Text({ text: '' });
  private readonly pinIcon = new PIXI.Graphics();
  private readonly audioIcon = new PIXI.Graphics();
  private readonly collapseBadge = new PIXI.Container();
  private readonly collapseBadgeBg = new PIXI.Graphics();
  private readonly collapseIcon = new PIXI.Graphics();
  private readonly tagDots = new PIXI.Container();
  private readonly tagDotPool: PIXI.Graphics[] = [];
  private readonly fallbackDot = new PIXI.Graphics();
  private readonly textContainer = new PIXI.Container();

  private state: NodeVisualState = {
    lod: 'full',
    styleKey: '',
    textKey: '',
    tagKey: '',
    faviconKey: '',
    themeVersion: 0,
    openProgress: 1,
    textResolution: 1,
  };
  private readonly fonts: { base: string; weight: TextStyleFontWeight };
  private readonly invalidate: () => void;
  private pinIconKey = '';
  private audioIconKey = '';
  private collapseBadgeKey = '';
  private collapseIconKey = '';
  private destroyed = false;
  private pendingFaviconUrl: FaviconUrl | null = null;
  private latestFaviconCandidate: FaviconUrl | null = null;
  /** When true, skip text/favicon rendering on first update to avoid frame drops
   * when many nodes become visible at once.  Cleared after the first update. */
  private deferContent = true;

  constructor(id: NodeId, fontFamily: string, invalidate: () => void) {
    this.id = id;
    this.fonts = { base: fontFamily, weight: '500' };
    this.invalidate = invalidate;
    this.container.addChild(this.background);
    this.container.addChild(this.fallbackDot);
    this.container.addChild(this.faviconBg);
    if (this.faviconSprite) this.container.addChild(this.faviconSprite);
    this.container.addChild(this.textContainer);
    this.textContainer.addChild(this.titleText);
    this.textContainer.addChild(this.urlText);
    this.container.addChild(this.tabBadge);
    this.tabBadge.addChild(this.tabBadgeBg);
    this.tabBadge.addChild(this.tabBadgeText);
    this.container.addChild(this.pinIcon);
    this.container.addChild(this.audioIcon);
    this.container.addChild(this.collapseBadge);
    this.collapseBadge.addChild(this.collapseBadgeBg);
    this.collapseBadge.addChild(this.collapseIcon);
    this.container.addChild(this.tagDots);
    for (let i = 0; i < 4; i++) {
      const dot = new PIXI.Graphics();
      dot.visible = false;
      this.tagDots.addChild(dot);
      this.tagDotPool.push(dot);
    }
    this.tabBadgeText.anchor.set(0.5, 0.5);
    this.pinIcon.pivot.set(ICON_VIEWBOX, 0);
    this.audioIcon.pivot.set(ICON_VIEWBOX, 0);
    this.pinIcon.scale.set(STATUS_ICON_SCALE);
    this.audioIcon.scale.set(STATUS_ICON_SCALE);
    this.collapseIcon.pivot.set(ICON_VIEWBOX / 2, ICON_VIEWBOX / 2);
    this.collapseIcon.scale.set(COLLAPSE_ICON_SCALE);
  }

  destroy() {
    this.destroyed = true;
    this.container.destroy({ children: true });
  }

  update(
    model: NodeRenderModel,
    view: ViewState,
    theme: ReturnType<typeof readGraphTheme>,
    origin: { x: number; y: number },
    fontFamily: string,
    themeVersion: number,
    detailMode: DetailMode,
    textResolution: number,
    isSelected: boolean,
    isPreview: boolean
  ) {
    this.fonts.base = fontFamily;
    const lod = resolveNodeLod(model, view, detailMode, isSelected);

    const rawOpenProgress = model.display.dimClosedNodes
      ? model.openProgress
      : 1;
    const openProgress = Math.min(1, Math.max(0, rawOpenProgress ?? (model.isOpen ? 1 : 0)));

    const nextStyleKey = [
      model.isCurrent ? 'c' : 'n',
      model.isOpen ? 'o' : 'x',
      isSelected ? 's' : 'n',
      isPreview ? 'p' : 'n',
      model.isSearchMatch ? 'm' : 'n',
      model.isSearchFocused ? 'f' : 'n',
      model.isHoverFocused ? 'h' : 'n',
      model.tabState?.sound.muted ? 'u' : 'n',
      model.display.dimClosedNodes && !model.isOpen ? 'd' : 'n',
    ].join('');

    const showFull = lod === 'full';
    const showLow = lod === 'low';
    const showFavicon = model.display.showFavicons && (showFull || showLow);
    const showUrls = model.display.showUrls && showFull;
    const title = lod === 'dot' ? '' : model.node.data.title || 'Untitled';
    const url = lod === 'dot' ? '' : model.node.data.url ? formatUrl(model.node.data.url) : '';
    const textKey =
      lod === 'dot'
        ? 'dot'
        : `${title}|${url}|${model.display.titleTruncation}|${showUrls ? 'u' : 'n'}|${showFavicon ? 'f' : 'n'}`;
    const tagKey =
      lod === 'full' && model.display.showTagDots && model.node.data.tags?.length
        ? model.node.data.tags.join(',')
        : '';
    const rawFavicon = lod === 'dot' ? null : showFavicon && model.node.data.url
      ? getFaviconUrl(model.node.data.url)
      : null;
    const safeFavicon = rawFavicon && isSafeFavicon(rawFavicon) ? rawFavicon : null;
    const cachedFavicon = safeFavicon ? getCachedFaviconTexture(safeFavicon) : null;
    const faviconKey = `${showFavicon ? '1' : '0'}|${safeFavicon ?? 'none'}|${cachedFavicon ? '1' : '0'}`;

    const themeChanged = this.state.themeVersion !== themeVersion;
    const openProgressChanged = Math.abs(this.state.openProgress - openProgress) > 0.001;
    // LOD-dependent changes are already encoded in the respective keys (textKey
    // includes showUrls/showFavicon, tagKey is '' outside full, faviconKey
    // includes showFavicon).  Removing the redundant `lod !== lod` check avoids
    // expensive background/text rebuilds that don't actually change anything.
    const needsStyleUpdate =
      themeChanged || this.state.styleKey !== nextStyleKey || openProgressChanged;
    const needsTextUpdate =
      themeChanged || this.state.textKey !== textKey || openProgressChanged || this.state.textResolution !== textResolution;
    const needsTagUpdate = themeChanged || this.state.tagKey !== tagKey;
    const needsFaviconUpdate =
      themeChanged || this.state.faviconKey !== faviconKey;

    if (this.state.textResolution !== textResolution) {
      this.titleText.resolution = textResolution;
      this.urlText.resolution = textResolution;
      this.tabBadgeText.resolution = textResolution;
    }

    this.state = {
      lod,
      styleKey: nextStyleKey,
      textKey,
      tagKey,
      faviconKey,
      themeVersion,
      openProgress,
      textResolution,
    };

    this.container.visible = lod !== 'hidden';
    if (lod === 'hidden') return;

    this.container.alpha = model.isSearchDimmed ? 0.3 : 1;
    this.container.position.set(model.x - origin.x, model.y - origin.y);
    this.container.zIndex = computeZIndex(model, isSelected);

    if (needsStyleUpdate) {
      this.drawBackground(model, theme, lod, isSelected, isPreview);
    }

    if (lod === 'dot') {
      this.textContainer.visible = false;
      this.tagDots.visible = false;
      this.faviconBg.visible = false;
      if (this.faviconSprite) this.faviconSprite.visible = false;
      this.tabBadge.visible = false;
      this.pinIcon.visible = false;
      this.audioIcon.visible = false;
      this.collapseBadge.visible = false;
      return;
    }

    // Defer expensive text/favicon rendering for brand-new nodes so the graph
    // structure (backgrounds + connections) can paint without frame drops.
    // Content appears on the very next render cycle.
    if (this.deferContent) {
      this.deferContent = false;
      this.textContainer.visible = false;
      this.faviconBg.visible = false;
      if (this.faviconSprite) this.faviconSprite.visible = false;
      this.tabBadge.visible = false;
      this.pinIcon.visible = false;
      this.audioIcon.visible = false;
      this.collapseBadge.visible = false;
      this.tagDots.visible = false;
      // Force state keys to empty so the next update will populate everything.
      this.state = { ...this.state, textKey: '', tagKey: '', faviconKey: '' };
      this.invalidate();
      return;
    }

    if (needsTextUpdate) {
      this.updateText(model, theme, lod, fontFamily, showFavicon);
    }

    if (needsTagUpdate) {
      this.updateTags(model, theme, lod);
    }

    if (needsFaviconUpdate) {
      this.updateFavicon(model, theme, lod, showFavicon, safeFavicon, cachedFavicon);
    }

    this.updateBadges(model, theme, lod);
  }

  private drawBackground(
    model: NodeRenderModel,
    theme: ReturnType<typeof readGraphTheme>,
    lod: LODLevel,
    isSelected: boolean,
    isPreview: boolean
  ) {
    const selected = isSelected || model.isSearchMatch || model.isSearchFocused;
    const preview = isPreview && !isSelected;
    const isHover = model.isHoverFocused;
    const isMuted = model.tabState?.sound.muted ?? false;
    const rawOpenProgress = model.display.dimClosedNodes ? model.openProgress : 1;
    const openProgress = Math.min(1, Math.max(0, rawOpenProgress ?? (model.isOpen ? 1 : 0)));
    const closedFactor = 1 - openProgress;

    const computeStyle = (closed: boolean) => {
      const isActive = model.isCurrent && !closed;
      const openBackground = isActive ? theme.active.background : theme.surfaceContainer;
      let backgroundColor = openBackground;
      if (closed) {
        const isDarkTheme = getLuminance(theme.surface) < 0.5;
        const closedBase = mixColors(openBackground, theme.closed.background, 0.9);
        const toned = isDarkTheme
          ? scaleColor(closedBase, 0.4)
          : mixColors(closedBase, theme.surface, 0.96);
        backgroundColor = desaturateColor(toned, 0.75);
      }
      let borderColor = closed ? theme.closed.border : isActive ? theme.active.border : theme.outline;
      let borderWidth = isActive ? 2 : 1;
      const useDashedBorder = closed && !(selected || isHover || preview || isMuted);

      if (isMuted) {
        borderColor = 0xdc3545;
        borderWidth = 2;
      } else if (selected || isHover || preview) {
        borderColor = theme.primary;
        borderWidth = 2;
      }

      return { backgroundColor, borderColor, borderWidth, useDashedBorder };
    };

    const openStyle = computeStyle(false);
    const closedStyle = computeStyle(true);
    const backgroundColor =
      closedFactor > 0 ? mixColors(openStyle.backgroundColor, closedStyle.backgroundColor, closedFactor) : openStyle.backgroundColor;
    const borderColor =
      closedFactor > 0 ? mixColors(openStyle.borderColor, closedStyle.borderColor, closedFactor) : openStyle.borderColor;
    const borderWidth = openStyle.borderWidth + (closedStyle.borderWidth - openStyle.borderWidth) * closedFactor;
    const useDashedBorder = closedFactor > 0.85 ? closedStyle.useDashedBorder : openStyle.useDashedBorder;

    this.background.clear();
    const radius = NODE_RADIUS;
    this.background.roundRect(0, 0, model.width, model.height, radius);
    this.background.fill({ color: backgroundColor, alpha: 1 });
    if (borderWidth > 0 && !useDashedBorder) {
      this.background.stroke({ width: borderWidth, color: borderColor, alignment: 0.5 });
    }

    this.fallbackDot.clear();

    if (useDashedBorder) {
      const dashedWidth = Math.max(borderWidth, 2);
      this.background.setStrokeStyle({ width: dashedWidth, color: borderColor, alignment: 0.5 });
      this.background.beginPath();
      drawDashedRoundedRect(this.background, 0, 0, model.width, model.height, NODE_RADIUS, 6, 4);
      this.background.stroke();
    }

    if (preview) {
      this.background.setStrokeStyle({ width: 2, color: borderColor, alignment: 0.5 });
      this.background.beginPath();
      drawDashedRoundedRect(this.background, 0, 0, model.width, model.height, NODE_RADIUS, 6, 4);
      this.background.stroke();
    }
  }

  private updateText(
    model: NodeRenderModel,
    theme: ReturnType<typeof readGraphTheme>,
    lod: LODLevel,
    fontFamily: string,
    showFavicon: boolean
  ) {
    const showFull = lod === 'full';
    const showLow = lod === 'low';
    const showUrls = model.display.showUrls && showFull;
    const showTitle = showFull || showLow;
    const rawOpenProgress = model.display.dimClosedNodes ? model.openProgress : 1;
    const openProgress = Math.min(1, Math.max(0, rawOpenProgress ?? (model.isOpen ? 1 : 0)));
    const closedFactor = 1 - openProgress;

    const openTitleColor = model.isCurrent ? theme.active.title : theme.onSurface;
    const closedTitleColor = theme.closed.title;
    const openUrlColor = model.isCurrent ? theme.active.url : theme.onSurfaceVariant;
    const closedUrlColor = theme.closed.url;
    const titleColor =
      closedFactor > 0 ? mixColors(openTitleColor, closedTitleColor, closedFactor) : openTitleColor;
    const urlColor =
      closedFactor > 0 ? mixColors(openUrlColor, closedUrlColor, closedFactor) : openUrlColor;

    this.titleText.style.fontFamily = fontFamily;
    this.titleText.style.fontWeight = this.fonts.weight;
    this.titleText.style.fontSize = TITLE_FONT_SIZE;
    this.titleText.style.fill = titleColor;
    this.urlText.style.fontFamily = fontFamily;
    this.urlText.style.fontWeight = '400';
    this.urlText.style.fontSize = URL_FONT_SIZE;
    this.urlText.style.fill = urlColor;

    const title = model.node.data.title || 'Untitled';
    const url = model.node.data.url ? formatUrl(model.node.data.url) : '';
    const maxTitleChars = Math.max(10, Math.floor((model.width - 70) / 6.5));
    const displayTitle = truncateTitle(title, model.display.titleTruncation, maxTitleChars);
    const displayUrl = truncateTitle(url, model.display.titleTruncation, maxTitleChars);

    this.titleText.text = showTitle ? displayTitle : '';
    this.urlText.text = showUrls ? displayUrl : '';

    const contentX = NODE_PADDING_X + (showFavicon ? FAVICON_SIZE + NODE_GAP : 0);
    const textBlockHeight = showUrls ? TITLE_FONT_SIZE + URL_FONT_SIZE + 4 : TITLE_FONT_SIZE;
    const textStartY = (model.height - textBlockHeight) / 2;

    this.textContainer.visible = showTitle || showUrls;
    this.textContainer.position.set(contentX, textStartY);
    this.titleText.y = 0;
    this.urlText.y = showUrls ? TITLE_FONT_SIZE + 2 : 0;
  }

  private updateFavicon(
    model: NodeRenderModel,
    theme: ReturnType<typeof readGraphTheme>,
    _lod: LODLevel,
    showFavicon: boolean,
    faviconUrl: FaviconUrl | null,
    cachedTexture: PIXI.Texture | null
  ) {
    this.faviconBg.visible = showFavicon;
    if (!showFavicon) {
      this.latestFaviconCandidate = null;
      if (this.faviconSprite) this.faviconSprite.visible = false;
      return;
    }

    const faviconX = NODE_PADDING_X;
    const faviconY = (model.height - FAVICON_SIZE) / 2;
    this.faviconBg.clear();
    this.faviconBg.roundRect(faviconX, faviconY, FAVICON_SIZE, FAVICON_SIZE, 6);
    this.faviconBg.fill({ color: theme.surfaceContainerHigh, alpha: 1 });

    this.latestFaviconCandidate = faviconUrl ?? null;
    if (faviconUrl) {
      if (cachedTexture) {
        this.applyFaviconTexture(cachedTexture, faviconX, faviconY);
        return;
      }
      this.requestFaviconLoad(faviconUrl);
    }

    if (this.faviconSprite) this.faviconSprite.visible = false;
  }

  private applyFaviconTexture(
    texture: PIXI.Texture,
    faviconX: number,
    faviconY: number
  ) {
    if (!this.faviconSprite) {
      this.faviconSprite = new PIXI.Sprite(texture);
      this.container.addChild(this.faviconSprite);
    } else {
      this.faviconSprite.texture = texture;
    }
    this.faviconSprite.visible = true;
    this.faviconSprite.width = FAVICON_ICON;
    this.faviconSprite.height = FAVICON_ICON;
    this.faviconSprite.position.set(
      faviconX + (FAVICON_SIZE - FAVICON_ICON) / 2,
      faviconY + (FAVICON_SIZE - FAVICON_ICON) / 2
    );
  }

  private requestFaviconLoad(faviconUrl: FaviconUrl) {
    if (this.pendingFaviconUrl === faviconUrl) return;
    this.pendingFaviconUrl = faviconUrl;
    void loadFaviconTexture(faviconUrl).then((texture) => {
      if (this.destroyed || this.latestFaviconCandidate !== faviconUrl) {
        this.pendingFaviconUrl = null;
        return;
      }
      this.pendingFaviconUrl = null;
      this.invalidate();
    });
  }

  private updateBadges(
    model: NodeRenderModel,
    theme: ReturnType<typeof readGraphTheme>,
    lod: LODLevel
  ) {
    const showFull = lod === 'full';
    const showBadges = showFull;

    this.tabBadge.visible = showBadges && model.display.showTabCounts && model.tabCount > 1;
    if (this.tabBadge.visible) {
      const badgeText = `${model.tabCount}x`;
      this.tabBadgeText.text = badgeText;
      this.tabBadgeText.style.fontSize = 9;
      this.tabBadgeText.style.fill = theme.onPrimary;
      this.tabBadgeText.style.fontWeight = '700';
      const metrics = PIXI.CanvasTextMetrics.measureText(badgeText, this.tabBadgeText.style);
      const badgeWidth = metrics.width + TAB_BADGE_PADDING_X * 2;
      const badgeHeight = metrics.height + TAB_BADGE_PADDING_Y * 2;
      this.tabBadgeBg.clear();
      this.tabBadgeBg.roundRect(0, 0, badgeWidth, badgeHeight, 6);
      this.tabBadgeBg.fill({ color: theme.primary, alpha: 1 });
      this.tabBadge.position.set(-2, -2);
      this.tabBadgeText.position.set(badgeWidth / 2, badgeHeight / 2 + 0.5);
    }

    const showPin = showBadges && model.node.data.pinned;
    const showAudio =
      showBadges && model.display.showAudioIndicators && Boolean(model.tabState?.sound.audible);

    if (showPin) {
      const pinKey = `Pin|${theme.onSurfaceVariant}|${STATUS_ICON_STROKE}`;
      if (this.pinIconKey !== pinKey) {
        const svg = getLucideSvg('Pin', theme.onSurfaceVariant, STATUS_ICON_STROKE);
        if (svg) {
          this.pinIcon.clear();
          this.pinIcon.svg(svg);
          this.pinIconKey = pinKey;
        }
      }
      this.pinIcon.position.set(model.width - 6, 4);
      this.pinIcon.visible = this.pinIconKey === pinKey;
    } else {
      this.pinIcon.visible = false;
    }
    if (showAudio) {
      const iconName = model.tabState?.sound.muted ? 'VolumeX' : 'Volume2';
      const audioKey = `${iconName}|${theme.primary}|${STATUS_ICON_STROKE}`;
      if (this.audioIconKey !== audioKey) {
        const svg = getLucideSvg(iconName, theme.primary, STATUS_ICON_STROKE);
        if (svg) {
          this.audioIcon.clear();
          this.audioIcon.svg(svg);
          this.audioIconKey = audioKey;
        }
      }
      const offset = showPin ? 18 : 6;
      this.audioIcon.position.set(model.width - offset, 4);
      this.audioIcon.visible = this.audioIconKey === audioKey;
    } else {
      this.audioIcon.visible = false;
    }

    this.updateCollapseBadge(model, theme, showBadges);
  }

  private updateCollapseBadge(
    model: NodeRenderModel,
    theme: ReturnType<typeof readGraphTheme>,
    showBadges: boolean
  ) {
    const show = showBadges && model.isCollapsed;
    this.collapseBadge.visible = show;
    if (!show) return;

    const badgeKey = `${theme.surfaceContainerHigh}|${theme.primary}|${theme.outline}`;
    if (this.collapseBadgeKey !== badgeKey) {
      const radius = COLLAPSE_BADGE_SIZE / 2;
      this.collapseBadgeBg.clear();
      this.collapseBadgeBg.circle(radius, radius, radius);
      this.collapseBadgeBg.fill({ color: theme.surfaceContainerHigh, alpha: 0.95 });
      this.collapseBadgeBg.stroke({ width: 1, color: theme.primary, alignment: 0.5 });
      this.collapseBadgeKey = badgeKey;
    }

    const iconKey = `${COLLAPSE_ICON_NAME}|${theme.primary}|${COLLAPSE_ICON_STROKE}`;
    if (this.collapseIconKey !== iconKey) {
      const svg = getLucideSvg(COLLAPSE_ICON_NAME, theme.primary, COLLAPSE_ICON_STROKE);
      if (svg) {
        this.collapseIcon.clear();
        this.collapseIcon.svg(svg);
        this.collapseIconKey = iconKey;
      }
    }

    const rect = getCollapseBadgeRect(model.width, model.height);
    this.collapseBadge.position.set(rect.x, rect.y);
    this.collapseIcon.position.set(rect.size / 2, rect.size / 2);
  }

  private updateTags(
    model: NodeRenderModel,
    theme: ReturnType<typeof readGraphTheme>,
    lod: LODLevel
  ) {
    const show = lod === 'full' && model.display.showTagDots;
    this.tagDots.visible = show;
    if (!show) {
      for (let i = 0; i < this.tagDotPool.length; i++) {
        this.tagDotPool[i].visible = false;
      }
      return;
    }
    const tags = model.node.data.tags ?? [];
    const maxTags = Math.min(tags.length, 4);
    if (maxTags === 0) {
      for (let i = 0; i < this.tagDotPool.length; i++) {
        this.tagDotPool[i].visible = false;
      }
      return;
    }
    const dotSize = 10;
    const gap = 3;
    let x = model.width - dotSize - 4;
    const y = model.height - dotSize - 4;
    let poolIdx = 0;
    for (let i = 0; i < maxTags; i += 1) {
      const tagId = tags[i];
      if (!tagId) continue;
      const tagPreset = model.tagDefs[tagId];
      if (!tagPreset) continue;
      const dot = this.tagDotPool[poolIdx];
      dot.clear();
      dot.circle(0, 0, dotSize / 2);
      dot.fill({ color: safeColor(tagPreset.color, theme.primary), alpha: 1 });
      dot.position.set(x + dotSize / 2, y + dotSize / 2);
      dot.visible = true;
      poolIdx++;
      x -= dotSize + gap;
    }
    // Hide remaining unused pool items
    for (let i = poolIdx; i < this.tagDotPool.length; i++) {
      this.tagDotPool[i].visible = false;
    }
  }
}

class GraphicsPool {
  private readonly pool: PIXI.Graphics[] = [];
  private activeCount = 0;
  private readonly parent: PIXI.Container;

  constructor(capacity: number, parent: PIXI.Container) {
    this.parent = parent;
    for (let i = 0; i < capacity; i++) {
      const g = new PIXI.Graphics();
      g.visible = false;
      parent.addChild(g);
      this.pool.push(g);
    }
  }

  acquire(): PIXI.Graphics {
    let g: PIXI.Graphics;
    if (this.activeCount < this.pool.length) {
      g = this.pool[this.activeCount];
    } else {
      g = new PIXI.Graphics();
      this.parent.addChild(g);
      this.pool.push(g);
    }
    this.activeCount++;
    g.visible = true;
    return g;
  }

  releaseAll() {
    for (let i = 0; i < this.activeCount; i++) {
      const g = this.pool[i];
      g.clear();
      g.visible = false;
    }
    this.activeCount = 0;
  }

  destroyAll() {
    for (const g of this.pool) {
      g.destroy();
    }
    this.pool.length = 0;
    this.activeCount = 0;
  }
}

export class GraphPixiRenderer {
  private readonly host: HTMLDivElement;
  private readonly app: PIXI.Application;
  private readonly world = new PIXI.Container();
  private readonly connectionLayer = new PIXI.Graphics();
  private readonly pathLayer = new PIXI.Graphics();
  private readonly connectionAlphaFilter = new PIXI.AlphaFilter({ alpha: 1 });
  private readonly pathAlphaFilter = new PIXI.AlphaFilter({ alpha: 1 });
  private readonly nodeLayer = new PIXI.Container();
  private readonly particleLayer = new PIXI.Container();
  private readonly particlePool = new GraphicsPool(32, this.particleLayer);
  private readonly nodeMap = new Map<NodeId, NodeVisual>();
  private readonly nodeData = new Map<NodeId, NodeRenderModel>();
  private index = new SpatialIndex<NodeId>(300);
  private connections: ConnectionSegment[] = [];
  private connectionsDirty = true;
  private lastConnectionViewRect: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  private particles: ParticleRenderModel[] = [];
  private view: ViewState = { translateX: 0, translateY: 0, scale: 1 };
  private data: GraphSnapshot & { particles: ParticleRenderModel[] } = {
    ...createGraphSnapshot({
      version: 0,
      nodes: [],
      basePositions: new Map(),
      connections: [],
      layoutMode: 'tree',
      nodeWidth: 0,
      nodeHeight: 0,
      showConnections: false,
    }),
    particles: [],
  };
  private theme = readGraphTheme({ host: document.body });
  private themeVersion = 0;
  private fontFamily = '"Inter", system-ui, sans-serif';
  private detailMode: DetailMode = 'full';
  private connectionQuality: ConnectionQuality = 'full';
  private textResolution = 1;
  private selectedNodeIds: Set<NodeId> = new Set();
  private selectionPreviewIds: Set<NodeId> | null = null;
  private lastSelectionPreviewIds: Set<NodeId> | null = null;
  private hoverNodeId: NodeId | null = null;
  private visibleIdsCache: Set<NodeId> = new Set();
  private origin = { x: 0, y: 0 };
  private cachedCullingRect: WorldRect | null = null;
  private needsRender = false;
  private destroyed = false;
  private isReady = false;
  private canvas: HTMLCanvasElement | null = null;
  private dppxMediaQuery: MediaQueryList | null = null;
  private dppxMediaQueryListener: (() => void) | null = null;
  private initPromise: Promise<void> | null = null;
  private metrics: GraphRenderMetrics = {
    updateVisibleMs: 0,
    connectionsMs: 0,
    renderMs: 0,
    visibleNodes: 0,
    visibleConnections: 0,
    selectionQueryMs: 0,
    selectionPatchMs: 0,
    selectionChangedCount: 0,
  };
  private metricsListener: ((metrics: GraphRenderMetrics) => void) | null = null;
  private readonly requestRender = () => {
    if (this.destroyed) return;
    this.invalidateVisible();
  };

  constructor(host: HTMLDivElement) {
    this.host = host;
    this.app = new PIXI.Application();
    this.app.stage.addChild(this.world);
    this.connectionLayer.filters = [this.connectionAlphaFilter];
    this.pathLayer.filters = [this.pathAlphaFilter];
    this.world.addChild(this.connectionLayer);
    this.world.addChild(this.pathLayer);
    this.world.addChild(this.nodeLayer);
    this.world.addChild(this.particleLayer);
    this.nodeLayer.sortableChildren = true;
    this.initPromise = this.init();
  }

  private async init() {
    try {
      await this.app.init({
        antialias: true,
        backgroundAlpha: 0,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        // resizeTo intentionally omitted — resize is handled by the
        // ResizeObserver in GraphCanvas which calls resizeToHost() and
        // immediately re-renders. PixiJS's built-in resizeTo clears
        // the canvas without re-rendering (ticker is stopped).
        powerPreference: 'high-performance',
      });
      if (this.destroyed) {
        this.app.destroy(true, { children: true });
        return;
      }
      const canvas = this.app.canvas as HTMLCanvasElement;
      this.canvas = canvas;
      this.host.appendChild(canvas);
      this.app.ticker?.stop();
      this.isReady = true;
      this.syncResolution();
      this.resizeToHost();
      this.syncTextResolution();
      this.watchDevicePixelRatio();
      this.updateOrigin();
      this.updateWorldTransform();
      this.refreshTheme();
    } catch (error) {
      console.error('Failed to initialize Pixi renderer:', error);
    }
  }

  destroy() {
    this.destroyed = true;
    this.unwatchDevicePixelRatio();
    this.nodeMap.forEach((visual) => visual.destroy());
    this.nodeMap.clear();
    this.nodeData.clear();
    this.index.clear();
    this.particlePool.destroyAll();
    if (this.isReady) {
      this.app.destroy(true, { children: true });
      if (this.canvas && this.host.contains(this.canvas)) {
        this.host.removeChild(this.canvas);
      }
      this.canvas = null;
    } else {
      this.initPromise?.then(() => {
        if (this.destroyed) {
          this.app.destroy(true, { children: true });
        }
      });
    }
  }

  private watchDevicePixelRatio() {
    this.unwatchDevicePixelRatio();
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    this.dppxMediaQuery = window.matchMedia(`(resolution: ${ratio}dppx)`);
    this.dppxMediaQueryListener = () => {
      if (this.destroyed) return;
      this.syncResolution();
      this.watchDevicePixelRatio();
    };
    this.dppxMediaQuery.addEventListener('change', this.dppxMediaQueryListener);
  }

  private unwatchDevicePixelRatio() {
    if (this.dppxMediaQuery && this.dppxMediaQueryListener) {
      this.dppxMediaQuery.removeEventListener('change', this.dppxMediaQueryListener);
    }
    this.dppxMediaQuery = null;
    this.dppxMediaQueryListener = null;
  }

  private syncResolution() {
    if (!this.isReady) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    if (Math.abs(this.app.renderer.resolution - ratio) < 0.001) return;
    this.app.renderer.resolution = ratio;
    this.app.renderer.resize(this.host.clientWidth, this.host.clientHeight);
    this.syncTextResolution();
    this.invalidateAll();
  }

  resizeToHost() {
    if (!this.isReady) return;
    this.app.renderer.resize(this.host.clientWidth, this.host.clientHeight);
    this.updateOrigin();
    this.updateWorldTransform();
    this.syncTextResolution();
    this.invalidateVisible();
  }

  private syncTextResolution() {
    if (!this.isReady) return;
    const target = this.view.scale * this.app.renderer.resolution;
    const next = Math.max(1, Math.min(8, Math.ceil(target)));
    this.textResolution = next;
  }

  refreshTheme() {
    this.theme = readGraphTheme({ host: this.host });
    const style = getComputedStyle(this.host);
    this.fontFamily = style.fontFamily || this.fontFamily;
    this.themeVersion += 1;
    if (!this.isReady) return;
    this.connectionsDirty = true;
    this.lastConnectionViewRect = null;
    this.invalidateAll();
  }

  setDetailMode(mode: DetailMode) {
    if (this.detailMode === mode) return;
    this.detailMode = mode;
    this.invalidateAll();
  }

  setConnectionQuality(quality: ConnectionQuality) {
    if (this.connectionQuality === quality) return;
    this.connectionQuality = quality;
    this.connectionsDirty = true;
    this.lastConnectionViewRect = null;
    this.invalidateAll();
  }

  setMetricsListener(listener: ((metrics: GraphRenderMetrics) => void) | null) {
    this.metricsListener = listener;
  }

  setSelectedNodeIds(ids: Set<NodeId>) {
    if (this.selectedNodeIds === ids) return;
    this.selectedNodeIds = ids;
    if (!this.isReady || this.selectionPreviewIds) return;
    this.invalidateVisible();
  }

  setSelectionPreview(ids: Set<NodeId> | null) {
    const prev = this.selectionPreviewIds ?? new Set<NodeId>();
    const next = ids ?? new Set<NodeId>();
    if (!shouldEmitPreview(prev, next)) return;
    this.lastSelectionPreviewIds = this.selectionPreviewIds;
    this.selectionPreviewIds = ids ? new Set(ids) : null;
    if (!this.isReady) return;
    this.patchSelectionVisuals(prev, next);
  }

  clearSelectionPreview() {
    this.setSelectionPreview(null);
  }

  queryNearestNode(
    worldX: number,
    worldY: number,
    radius: number,
    excludeIds?: Set<NodeId>,
  ): NodeId | null {
    const result = this.index.queryNearest(worldX, worldY, radius, excludeIds);
    return result ? result.id : null;
  }

  queryNodesInWorldRect(rect: { minX: number; minY: number; maxX: number; maxY: number }): Set<NodeId> {
    const started = performance.now();
    const hits = this.index.query(rect);
    this.metrics.selectionQueryMs = performance.now() - started;
    return hits;
  }

  queryVisibleNodesInWorldRect(rect: { minX: number; minY: number; maxX: number; maxY: number }): Set<NodeId> {
    const started = performance.now();
    const hits = new Set<NodeId>();
    this.visibleIdsCache.forEach((id) => {
      const node = this.nodeData.get(id);
      if (!node) return;
      if (
        node.x <= rect.maxX &&
        node.x + node.width >= rect.minX &&
        node.y <= rect.maxY &&
        node.y + node.height >= rect.minY
      ) {
        hits.add(id);
      }
    });
    this.metrics.selectionQueryMs = performance.now() - started;
    return hits;
  }

  private getEffectiveSelection(): Set<NodeId> {
    return this.selectionPreviewIds ?? this.selectedNodeIds;
  }

  private patchSelectionVisuals(prevSelection: ReadonlySet<NodeId>, nextSelection: ReadonlySet<NodeId>) {
    const started = performance.now();
    const { added, removed, changedCount } = diffSelection(prevSelection, nextSelection);
    this.metrics.selectionChangedCount = changedCount;
    if (changedCount === 0) {
      this.metrics.selectionPatchMs = performance.now() - started;
      return;
    }

    const changed = new Set<NodeId>([...added, ...removed]);
    let patchedAny = false;
    changed.forEach((id) => {
      if (!this.visibleIdsCache.has(id)) return;
      const node = this.nodeData.get(id);
      if (!node) return;
      let visual = this.nodeMap.get(id);
      if (!visual) {
        visual = new NodeVisual(id, this.fontFamily, this.requestRender);
        this.nodeMap.set(id, visual);
        this.nodeLayer.addChild(visual.container);
      }
      visual.update(
        node,
        this.view,
        this.theme,
        this.origin,
        this.fontFamily,
        this.themeVersion,
        this.detailMode,
        this.textResolution,
        nextSelection.has(id),
        node.isPreview,
      );
      patchedAny = true;
    });

    if (patchedAny) {
      this.nodeLayer.sortDirty = true;
      this.needsRender = true;
      this.render();
    }
    this.metrics.selectionPatchMs = performance.now() - started;
  }

  setHoverNodeId(id: NodeId | null) {
    const prev = this.hoverNodeId;
    if (prev === id) return;
    this.hoverNodeId = id;
    if (!this.isReady) return;
    this.patchHoverVisual(prev, id);
  }

  private patchHoverVisual(prevId: NodeId | null, nextId: NodeId | null) {
    const ids: NodeId[] = [];
    if (prevId != null) ids.push(prevId);
    if (nextId != null) ids.push(nextId);
    if (ids.length === 0) return;

    const selection = this.getEffectiveSelection();
    let patchedAny = false;
    for (const id of ids) {
      if (!this.visibleIdsCache.has(id)) continue;
      const node = this.nodeData.get(id);
      if (!node) continue;
      const updatedNode = node.isHoverFocused !== (nextId === id)
        ? { ...node, isHoverFocused: nextId === id }
        : node;
      if (updatedNode !== node) {
        this.nodeData.set(id, updatedNode);
      }
      let visual = this.nodeMap.get(id);
      if (!visual) {
        visual = new NodeVisual(id, this.fontFamily, this.requestRender);
        this.nodeMap.set(id, visual);
        this.nodeLayer.addChild(visual.container);
      }
      visual.update(
        updatedNode,
        this.view,
        this.theme,
        this.origin,
        this.fontFamily,
        this.themeVersion,
        this.detailMode,
        this.textResolution,
        selection.has(id),
        updatedNode.isPreview,
      );
      patchedAny = true;
    }

    if (patchedAny) {
      this.nodeLayer.sortDirty = true;
      this.needsRender = true;
      this.render();
    }
  }

  setStaticGraph(snapshot: GraphSnapshot) {
    const start = performance.now();
    this.data = { ...snapshot, particles: this.particles };
    this.connections = [...snapshot.connections];
    this.connectionsDirty = true;
    this.lastConnectionViewRect = null;
    this.cachedCullingRect = null;
    this.visibleIdsCache = new Set();
    this.nodeData.clear();
    this.index = new SpatialIndex<NodeId>(Math.max(snapshot.nodeWidth, snapshot.nodeHeight) * 3);
    const ids = new Set<NodeId>();
    snapshot.nodes.forEach((node) => {
      this.nodeData.set(node.id, node);
      ids.add(node.id);
      this.index.insert(node.id, {
        minX: node.x,
        minY: node.y,
        maxX: node.x + node.width,
        maxY: node.y + node.height,
      });
    });
    for (const [id, visual] of this.nodeMap.entries()) {
      if (!ids.has(id)) {
        visual.destroy();
        this.nodeMap.delete(id);
      }
    }
    this.invalidateAll();
    graphProfiler.record('setStaticGraph', performance.now() - start);
  }

  patchStaticGraph(snapshot: GraphSnapshot) {
    const start = performance.now();
    const prevSnapshot: GraphSnapshot = {
      ...this.data,
      nodes: Array.from(this.nodeData.values()),
    };
    const diff = diffSnapshots(prevSnapshot, snapshot);

    // Update stored data
    this.data = { ...snapshot, particles: this.particles };
    this.connections = [...snapshot.connections];
    this.connectionsDirty = true;
    this.lastConnectionViewRect = null;

    // Patch nodeData and SpatialIndex incrementally
    for (const id of diff.removed) {
      this.nodeData.delete(id);
      this.index.remove(id);
      const visual = this.nodeMap.get(id);
      if (visual) {
        visual.destroy();
        this.nodeMap.delete(id);
      }
    }

    for (const node of diff.added) {
      this.nodeData.set(node.id, node);
      this.index.insert(node.id, {
        minX: node.x,
        minY: node.y,
        maxX: node.x + node.width,
        maxY: node.y + node.height,
      });
    }

    for (const node of diff.moved) {
      this.nodeData.set(node.id, node);
      this.index.update(node.id, {
        minX: node.x,
        minY: node.y,
        maxX: node.x + node.width,
        maxY: node.y + node.height,
      });
    }

    // Targeted invalidation (skip full invalidateAll)
    this.cachedCullingRect = null;
    this.needsRender = true;
    this.updateVisible();
    this.render();

    graphProfiler.record('patchStaticGraph', performance.now() - start);
  }

  setDynamicState(state: DynamicGraphState) {
    const start = performance.now();
    const incomingIds = new Set<NodeId>();
    state.nodes.forEach((node) => {
      incomingIds.add(node.id);
      const prev = this.nodeData.get(node.id);
      // Reconcile isHoverFocused with renderer's hover state
      const adjustedNode = node.isHoverFocused !== (node.id === this.hoverNodeId)
        ? { ...node, isHoverFocused: node.id === this.hoverNodeId }
        : node;
      this.nodeData.set(adjustedNode.id, adjustedNode);
      const rect = {
        minX: adjustedNode.x,
        minY: adjustedNode.y,
        maxX: adjustedNode.x + adjustedNode.width,
        maxY: adjustedNode.y + adjustedNode.height,
      };
      if (!prev) {
        // New node (e.g. exit animation node added after setStaticGraph) — insert into index
        this.index.insert(adjustedNode.id, rect);
      } else if (prev.x !== adjustedNode.x || prev.y !== adjustedNode.y || prev.width !== adjustedNode.width || prev.height !== adjustedNode.height) {
        // Position changed — update index entry
        this.index.update(adjustedNode.id, rect);
      }
    });
    // Remove nodes that disappeared (e.g. exit animation finished)
    for (const [id, visual] of this.nodeMap.entries()) {
      if (!incomingIds.has(id)) {
        this.nodeData.delete(id);
        this.index.remove(id);
        visual.destroy();
        this.nodeMap.delete(id);
      }
    }
    if (this.connections !== state.connections) {
      this.connections = state.connections;
      this.connectionsDirty = true;
    }
    this.data = { ...this.data, showConnections: state.showConnections };
    this.invalidateVisible();
    graphProfiler.record('setDynamicState', performance.now() - start);
  }

  setParticles(particles: ParticleRenderModel[]) {
    this.particles = particles;
    if (this.isReady) {
      this.invalidateVisible();
    }
  }

  setView(view: ViewState) {
    const prevView = this.view;
    this.view = view;
    if (!this.isReady) return;
    const originChanged = this.updateOrigin();
    this.updateWorldTransform();
    this.syncTextResolution();

    const invalidation = decideViewInvalidation({
      prevView,
      nextView: view,
      viewportWidth: this.host.clientWidth || 1,
      viewportHeight: this.host.clientHeight || 1,
      cachedCullingRect: this.cachedCullingRect,
      forceFull: this.cachedCullingRect === null,
      originChanged,
    });

    if (invalidation.decision === 'translate-only') {
      this.needsRender = true;
      this.render();
      return;
    }

    this.invalidateVisible(invalidation.nextCullingRect);
  }

  hitTestScreen(screenX: number, screenY: number, excludeIds?: Set<NodeId>): NodeId | null {
    const world = this.screenToWorld(screenX, screenY);
    return this.hitTestWorld(world.x, world.y, excludeIds);
  }

  hitTestTargetScreen(
    screenX: number,
    screenY: number
  ): { nodeId: NodeId; target: 'node' | 'collapse-icon' } | null {
    const world = this.screenToWorld(screenX, screenY);
    const nodeId = this.hitTestWorld(world.x, world.y);
    if (!nodeId) return null;
    const node = this.nodeData.get(nodeId);
    if (!node) return null;
    if (this.isCollapseBadgeVisible(node)) {
      const rect = getCollapseBadgeRect(node.width, node.height);
      const minX = node.x + rect.x;
      const minY = node.y + rect.y;
      const maxX = minX + rect.size;
      const maxY = minY + rect.size;
      if (world.x >= minX && world.x <= maxX && world.y >= minY && world.y <= maxY) {
        return { nodeId, target: 'collapse-icon' };
      }
    }
    return { nodeId, target: 'node' };
  }

  screenToWorld(screenX: number, screenY: number) {
    return {
      x: (screenX - this.view.translateX) / this.view.scale,
      y: (screenY - this.view.translateY) / this.view.scale,
    };
  }

  private hitTestWorld(worldX: number, worldY: number, excludeIds?: Set<NodeId>): NodeId | null {
    const candidates = this.index.query({
      minX: worldX,
      maxX: worldX,
      minY: worldY,
      maxY: worldY,
    });
    if (candidates.size === 0) return null;
    const selection = this.getEffectiveSelection();
    let topId: NodeId | null = null;
    let topZ = -Infinity;
    candidates.forEach((id) => {
      if (excludeIds?.has(id)) return;
      const node = this.nodeData.get(id);
      if (!node) return;
      if (
        worldX >= node.x &&
        worldX <= node.x + node.width &&
        worldY >= node.y &&
        worldY <= node.y + node.height
      ) {
        const z = computeZIndex(node, selection.has(id));
        if (z >= topZ) {
          topZ = z;
          topId = id;
        }
      }
    });
    return topId;
  }

  private isCollapseBadgeVisible(model: NodeRenderModel): boolean {
    if (!model.isCollapsed) return false;
    const selection = this.getEffectiveSelection();
    const lod = resolveNodeLod(model, this.view, this.detailMode, selection.has(model.id));
    return lod === 'full' || lod === 'low';
  }

  private invalidateAll() {
    if (!this.isReady) return;
    this.cachedCullingRect = null;
    this.connectionsDirty = true;
    this.lastConnectionViewRect = null;
    this.needsRender = true;
    this.updateVisible();
    this.render();
  }

  private invalidateVisible(cullingRect?: WorldRect) {
    if (!this.isReady) return;
    this.needsRender = true;
    this.updateVisible(cullingRect);
    this.render();
  }

  private emitMetrics() {
    if (!this.metricsListener) return;
    this.metricsListener({ ...this.metrics });
  }

  private render() {
    if (!this.isReady) return;
    if (!this.needsRender) return;
    this.needsRender = false;
    const start = performance.now();
    this.app.renderer.render(this.app.stage);
    this.metrics.renderMs = performance.now() - start;
    this.emitMetrics();
  }

  private updateOrigin(): boolean {
    const rect = this.getViewRect();
    const desiredX = Math.round(rect.minX + rect.width / 2);
    const desiredY = Math.round(rect.minY + rect.height / 2);
    const threshold = Math.max(rect.width, rect.height);
    if (
      Math.abs(desiredX - this.origin.x) > threshold ||
      Math.abs(desiredY - this.origin.y) > threshold
    ) {
      this.origin = { x: desiredX, y: desiredY };
      return true;
    }
    return false;
  }

  private updateWorldTransform() {
    this.world.scale.set(this.view.scale);
    this.world.position.set(
      this.view.translateX + this.origin.x * this.view.scale,
      this.view.translateY + this.origin.y * this.view.scale
    );
  }

  private updateVisible(cullingRect?: WorldRect) {
    const updateStart = performance.now();
    const viewRect = worldRectFromView(
      this.view,
      this.host.clientWidth || 1,
      this.host.clientHeight || 1,
    );
    const padding = 200 / this.view.scale;
    const paddedRect =
      cullingRect ?? {
        minX: viewRect.minX - padding,
        minY: viewRect.minY - padding,
        maxX: viewRect.maxX + padding,
        maxY: viewRect.maxY + padding,
      };
    this.cachedCullingRect = paddedRect;

    const selection = this.getEffectiveSelection();
    const visibleIds = this.index.query(paddedRect);
    this.visibleIdsCache = visibleIds;
    visibleIds.forEach((id) => {
      const node = this.nodeData.get(id);
      if (!node) return;
      let visual = this.nodeMap.get(id);
      if (!visual) {
        visual = new NodeVisual(id, this.fontFamily, this.requestRender);
        this.nodeMap.set(id, visual);
        this.nodeLayer.addChild(visual.container);
      }
      visual.update(
        node,
        this.view,
        this.theme,
        this.origin,
        this.fontFamily,
        this.themeVersion,
        this.detailMode,
        this.textResolution,
        selection.has(id),
        node.isPreview
      );
    });
    for (const [id, visual] of this.nodeMap.entries()) {
      if (!visibleIds.has(id)) {
        visual.container.visible = false;
      }
    }
    this.nodeLayer.sortDirty = true;
    const { connectionsMs, visibleConnections } = this.updateConnections(paddedRect);
    this.metrics.updateVisibleMs = performance.now() - updateStart;
    this.metrics.connectionsMs = connectionsMs;
    this.metrics.visibleNodes = visibleIds.size;
    this.metrics.visibleConnections = visibleConnections;
    graphProfiler.record('updateVisible', performance.now() - updateStart);
  }

  private updateConnections(viewRect: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): { connectionsMs: number; visibleConnections: number } {
    const start = performance.now();

    // Particles always need updating (they move every frame)
    this.particlePool.releaseAll();
    this.updateParticles();

    if (!this.data.showConnections) {
      if (this.connectionsDirty) {
        this.connectionLayer.clear();
        this.pathLayer.clear();
        this.connectionsDirty = false;
      }
      graphProfiler.record('updateConnections', performance.now() - start);
      return { connectionsMs: performance.now() - start, visibleConnections: 0 };
    }

    const representativePx = Math.min(this.data.nodeWidth, this.data.nodeHeight) * this.view.scale;
    if (representativePx < LOD_CONN_HIDE_PX) {
      if (this.connectionsDirty) {
        this.connectionLayer.clear();
        this.pathLayer.clear();
        this.connectionsDirty = false;
      }
      graphProfiler.record('updateConnections', performance.now() - start);
      return { connectionsMs: performance.now() - start, visibleConnections: 0 };
    }

    // Skip full redraw if connections haven't changed and viewport is same
    const viewUnchanged = this.lastConnectionViewRect !== null &&
      this.lastConnectionViewRect.minX === viewRect.minX &&
      this.lastConnectionViewRect.minY === viewRect.minY &&
      this.lastConnectionViewRect.maxX === viewRect.maxX &&
      this.lastConnectionViewRect.maxY === viewRect.maxY;

    if (!this.connectionsDirty && viewUnchanged) {
      graphProfiler.record('updateConnections', performance.now() - start);
      return { connectionsMs: performance.now() - start, visibleConnections: this.metrics.visibleConnections };
    }

    // Full redraw needed
    this.connectionLayer.clear();
    this.pathLayer.clear();
    this.connectionsDirty = false;
    this.lastConnectionViewRect = { ...viewRect };

    // Base connections and "active path" connections can share the same hue (theme-driven),
    // but must be visually distinct so the root -> current path reads as highlighted.
    const radial = this.data.layoutMode === 'radial';
    const thinQuality = this.connectionQuality === 'thin';
    const baseColor = this.theme.connection.base;
    const pathColor = this.theme.connection.path;
    const baseWidth =
      this.connectionQuality === 'full'
        ? 2 / this.view.scale
        : this.connectionQuality === 'simplified'
          ? 1.5 / this.view.scale
          : 1 / this.view.scale;
    const pathWidth =
      this.connectionQuality === 'full'
        ? 2.8 / this.view.scale
        : this.connectionQuality === 'simplified'
          ? 2.1 / this.view.scale
          : 1.6 / this.view.scale;
    const baseAlpha =
      this.connectionQuality === 'full'
        ? 0.22
        : this.connectionQuality === 'simplified'
          ? 0.18
          : 0.14;
    const pathAlpha =
      this.connectionQuality === 'full'
        ? 0.85
        : this.connectionQuality === 'simplified'
          ? 0.75
          : 0.62;
    this.connectionAlphaFilter.alpha = baseAlpha;
    this.pathAlphaFilter.alpha = pathAlpha;
    this.connectionLayer.setStrokeStyle({ width: baseWidth, color: baseColor });
    this.pathLayer.setStrokeStyle({ width: pathWidth, color: pathColor });

    let visibleConnections = 0;
    this.connections.forEach((conn) => {
      if (!intersects(conn.bounds, viewRect)) return;
      if (
        thinQuality &&
        !radial &&
        !conn.onPath &&
        hashConnectionId(conn.id) % 2 === 0
      ) {
        return;
      }

      visibleConnections += 1;
      const layer = conn.onPath ? this.pathLayer : this.connectionLayer;
      const startX = conn.start.x - this.origin.x;
      const startY = conn.start.y - this.origin.y;
      const endX = conn.end.x - this.origin.x;
      const endY = conn.end.y - this.origin.y;

      if (conn.style === 'orthogonal') {
        const cp1X = conn.cp1.x - this.origin.x;
        const cp1Y = conn.cp1.y - this.origin.y;
        const cp2X = conn.cp2.x - this.origin.x;
        const cp2Y = conn.cp2.y - this.origin.y;
        const isStraight =
          (Math.abs(startX - endX) < 0.5 && Math.abs(cp1X - startX) < 0.5) ||
          (Math.abs(startY - endY) < 0.5 && Math.abs(cp1Y - startY) < 0.5);

        const isLShape = Math.abs(cp1X - cp2X) < 0.5 && Math.abs(cp1Y - cp2Y) < 0.5;

        if (isStraight) {
          layer.moveTo(startX, startY);
          layer.lineTo(endX, endY);
        } else if (isLShape) {
          const seg1 = Math.hypot(cp1X - startX, cp1Y - startY);
          const seg2 = Math.hypot(endX - cp1X, endY - cp1Y);
          const r = this.connectionQuality === 'full'
            ? Math.min(16 / this.view.scale, seg1 / 2, seg2 / 2)
            : 0;
          layer.moveTo(startX, startY);
          if (r > 0.5) {
            layer.arcTo(cp1X, cp1Y, endX, endY, r);
          } else {
            layer.lineTo(cp1X, cp1Y);
          }
          layer.lineTo(endX, endY);
        } else if (this.connectionQuality === 'full') {
          const seg1 = Math.hypot(cp1X - startX, cp1Y - startY);
          const seg2 = Math.hypot(cp2X - cp1X, cp2Y - cp1Y);
          const seg3 = Math.hypot(endX - cp2X, endY - cp2Y);
          const r = Math.min(16 / this.view.scale, seg1 / 2, seg2 / 2, seg3 / 2);
          layer.moveTo(startX, startY);
          layer.arcTo(cp1X, cp1Y, cp2X, cp2Y, r);
          layer.arcTo(cp2X, cp2Y, endX, endY, r);
          layer.lineTo(endX, endY);
        } else {
          layer.moveTo(startX, startY);
          layer.lineTo(cp1X, cp1Y);
          layer.lineTo(cp2X, cp2Y);
          layer.lineTo(endX, endY);
        }
      } else {
        layer.moveTo(startX, startY);
        if (this.connectionQuality === 'full') {
          const cp1X = conn.cp1.x - this.origin.x;
          const cp1Y = conn.cp1.y - this.origin.y;
          const cp2X = conn.cp2.x - this.origin.x;
          const cp2Y = conn.cp2.y - this.origin.y;
          layer.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
        } else {
          layer.lineTo(endX, endY);
        }
      }
    });
    if (visibleConnections > 0) {
      this.connectionLayer.stroke();
      this.pathLayer.stroke();
    }

    graphProfiler.record('updateConnections', performance.now() - start);
    return {
      connectionsMs: performance.now() - start,
      visibleConnections,
    };
  }

  private updateParticles() {
    if (!this.isReady) return;
    const color = this.theme.connection.path;
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const circle = this.particlePool.acquire();
      circle.circle(0, 0, particle.radius);
      circle.fill({ color, alpha: particle.alpha });
      circle.position.set(particle.x - this.origin.x, particle.y - this.origin.y);
    }
  }

  private getViewRect() {
    const width = this.host.clientWidth || 1;
    const height = this.host.clientHeight || 1;
    const minX = (0 - this.view.translateX) / this.view.scale;
    const minY = (0 - this.view.translateY) / this.view.scale;
    const maxX = (width - this.view.translateX) / this.view.scale;
    const maxY = (height - this.view.translateY) / this.view.scale;
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}

function intersects(a: { minX: number; minY: number; maxX: number; maxY: number }, b: { minX: number; minY: number; maxX: number; maxY: number }) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function hashConnectionId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function truncateTitle(text: string, mode: GraphDisplayOptions['titleTruncation'], maxChars: number): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 1) return '…';
  const ellipsis = '…';
  const available = maxChars - 1;
  if (mode === 'start') {
    return `${ellipsis}${text.slice(text.length - available)}`;
  }
  if (mode === 'middle') {
    const left = Math.ceil(available / 2);
    const right = Math.floor(available / 2);
    return `${text.slice(0, left)}${ellipsis}${text.slice(text.length - right)}`;
  }
  return `${text.slice(0, available)}${ellipsis}`;
}

type DashState = {
  draw: boolean;
  remaining: number;
};

function drawDashedLine(
  graphics: PIXI.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dash: number,
  gap: number,
  state: DashState
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;
  let progress = 0;
  while (progress < length) {
    const step = Math.min(state.remaining, length - progress);
    const t1 = progress / length;
    const t2 = (progress + step) / length;
    if (state.draw) {
      const sx = x1 + dx * t1;
      const sy = y1 + dy * t1;
      const ex = x1 + dx * t2;
      const ey = y1 + dy * t2;
      graphics.moveTo(sx, sy);
      graphics.lineTo(ex, ey);
    }
    progress += step;
    if (step === state.remaining) {
      state.draw = !state.draw;
      state.remaining = state.draw ? dash : gap;
    } else {
      state.remaining -= step;
    }
  }
}

function drawDashedArc(
  graphics: PIXI.Graphics,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  dash: number,
  gap: number,
  state: DashState
) {
  if (radius <= 0) return;
  const delta = endAngle - startAngle;
  const arcLength = Math.abs(delta) * radius;
  if (arcLength === 0) return;
  const direction = delta >= 0 ? 1 : -1;
  let progress = 0;
  while (progress < arcLength) {
    const step = Math.min(state.remaining, arcLength - progress);
    if (state.draw) {
      const angle1 = startAngle + direction * (progress / radius);
      const angle2 = startAngle + direction * ((progress + step) / radius);
      const sx = cx + Math.cos(angle1) * radius;
      const sy = cy + Math.sin(angle1) * radius;
      graphics.moveTo(sx, sy);
      graphics.arc(cx, cy, radius, angle1, angle2, direction < 0);
    }
    progress += step;
    if (step === state.remaining) {
      state.draw = !state.draw;
      state.remaining = state.draw ? dash : gap;
    } else {
      state.remaining -= step;
    }
  }
}

function drawDashedRoundedRect(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  dash: number,
  gap: number
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = x + width;
  const bottom = y + height;
  const state: DashState = { draw: true, remaining: dash };

  if (r === 0) {
    drawDashedLine(graphics, x, y, right, y, dash, gap, state);
    drawDashedLine(graphics, right, y, right, bottom, dash, gap, state);
    drawDashedLine(graphics, right, bottom, x, bottom, dash, gap, state);
    drawDashedLine(graphics, x, bottom, x, y, dash, gap, state);
    return;
  }

  drawDashedLine(graphics, x + r, y, right - r, y, dash, gap, state);
  drawDashedArc(graphics, right - r, y + r, r, -Math.PI / 2, 0, dash, gap, state);
  drawDashedLine(graphics, right, y + r, right, bottom - r, dash, gap, state);
  drawDashedArc(graphics, right - r, bottom - r, r, 0, Math.PI / 2, dash, gap, state);
  drawDashedLine(graphics, right - r, bottom, x + r, bottom, dash, gap, state);
  drawDashedArc(graphics, x + r, bottom - r, r, Math.PI / 2, Math.PI, dash, gap, state);
  drawDashedLine(graphics, x, bottom - r, x, y + r, dash, gap, state);
  drawDashedArc(graphics, x + r, y + r, r, Math.PI, Math.PI * 1.5, dash, gap, state);
}

function isSafeFavicon(url: FaviconUrl): boolean {
  if (url.startsWith('data:') || url.startsWith('blob:')) return true;
  if (url.startsWith('http://') || url.startsWith('https://')) return true;
  if (url.startsWith('chrome-extension://')) {
    const base = getExtensionBaseUrl();
    return base ? url.startsWith(base) : false;
  }
  return false;
}

function computeZIndex(model: NodeRenderModel, isSelected: boolean): number {
  if (model.isSearchFocused) return 40;
  if (isSelected) return 30;
  if (model.isSearchMatch) return 25;
  if (model.isHoverFocused) return 20;
  if (model.isCurrent) return 15;
  return 1;
}

function mixColors(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bch = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bch;
}

function scaleColor(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (clamp8(r) << 16) | (clamp8(g) << 8) | clamp8(b);
}

function desaturateColor(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const gray = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const nr = Math.round(r + (gray - r) * amount);
  const ng = Math.round(g + (gray - g) * amount);
  const nb = Math.round(b + (gray - b) * amount);
  return (clamp8(nr) << 16) | (clamp8(ng) << 8) | clamp8(nb);
}

function clamp8(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

function getLuminance(color: number): number {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function srgbToLinear(value: number): number {
  if (value <= 0.04045) return value / 12.92;
  return Math.pow((value + 0.055) / 1.055, 2.4);
}

function safeColor(value: string, fallback: number): number {
  try {
    return PIXI.Color.shared.setValue(value).toNumber();
  } catch {
    return fallback;
  }
}

function getCachedFaviconTexture(url: FaviconUrl): PIXI.Texture | null {
  return faviconTextureCache.get(url) ?? null;
}

function loadFaviconTexture(url: FaviconUrl): Promise<PIXI.Texture | null> {
  const cached = faviconTextureCache.get(url);
  if (cached) return Promise.resolve(cached);
  const existing = faviconLoadPromises.get(url);
  if (existing) return existing;
  const promise = new Promise<PIXI.Texture | null>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const texture = PIXI.Texture.from(image);
        cacheFaviconTexture(url, texture);
        resolve(texture);
      } catch {
        resolve(null);
      } finally {
        faviconLoadPromises.delete(url);
      }
    };
    image.onerror = () => {
      faviconLoadPromises.delete(url);
      resolve(null);
    };
    image.src = url;
  });
  faviconLoadPromises.set(url, promise);
  return promise;
}

function getExtensionBaseUrl(): string | null {
  try {
    if (hasRuntimeGetURL()) {
      return runtimeGetURL('');
    }
  } catch {
    // ignore
  }
  return null;
}
