import * as PIXI from 'pixi.js';
import type { TextStyleFontWeight } from 'pixi.js';
import type { NodeId } from '../../../../shared/types/ids.js';
import { formatUrl } from '../../shared/format.js';
import type { ViewState } from '../types.js';
import type { ConnectionSegment, GraphDisplayOptions, NodeRenderModel } from './types.js';
import { SpatialIndex } from './spatial-index.js';
import { readGraphTheme } from './theme.js';

type RenderData = {
  nodes: NodeRenderModel[];
  connections: ConnectionSegment[];
  nodeWidth: number;
  nodeHeight: number;
  showConnections: boolean;
};

type LODLevel = 'hidden' | 'dot' | 'low' | 'full';
type DetailMode = 'full' | 'low' | 'dot';

const LOD_HIDE_PX = 6;
const LOD_DOT_PX = 14;
const LOD_LOW_PX = 28;

const NODE_RADIUS = 22;
const NODE_PADDING_X = 12;
const NODE_PADDING_Y = 8;
const NODE_GAP = 10;
const FAVICON_SIZE = 28;
const FAVICON_ICON = 18;

const TITLE_FONT_SIZE = 12;
const URL_FONT_SIZE = 10;

const TAB_BADGE_PADDING_X = 6;
const TAB_BADGE_PADDING_Y = 3;

const faviconTextureCache = new Map<string, PIXI.Texture>();
const faviconLoadPromises = new Map<string, Promise<PIXI.Texture | null>>();

type NodeVisualState = {
  lod: LODLevel;
  styleKey: string;
  textKey: string;
  tagKey: string;
  themeVersion: number;
};

class NodeVisual {
  readonly id: NodeId;
  readonly container = new PIXI.Container();
  private readonly background = new PIXI.Graphics();
  private readonly faviconBg = new PIXI.Graphics();
  private readonly faviconText = new PIXI.Text({ text: '' });
  private faviconSprite: PIXI.Sprite | null = null;
  private faviconUrl: string | null = null;
  private readonly titleText = new PIXI.Text({ text: '' });
  private readonly urlText = new PIXI.Text({ text: '' });
  private readonly tabBadge = new PIXI.Container();
  private readonly tabBadgeBg = new PIXI.Graphics();
  private readonly tabBadgeText = new PIXI.Text({ text: '' });
  private readonly pinText = new PIXI.Text({ text: '📌' });
  private readonly audioText = new PIXI.Text({ text: '🔊' });
  private readonly tagDots = new PIXI.Container();
  private readonly fallbackDot = new PIXI.Graphics();
  private readonly textContainer = new PIXI.Container();
  private state: NodeVisualState = { lod: 'full', styleKey: '', textKey: '', tagKey: '', themeVersion: 0 };
  private readonly fonts: { base: string; weight: TextStyleFontWeight };
  private readonly invalidate: () => void;
  private destroyed = false;
  private pendingFaviconUrl: string | null = null;
  private latestFaviconCandidate: string | null = null;

  constructor(id: NodeId, fontFamily: string, invalidate: () => void) {
    this.id = id;
    this.fonts = { base: fontFamily, weight: '500' };
    this.invalidate = invalidate;
    this.container.addChild(this.background);
    this.container.addChild(this.fallbackDot);
    this.container.addChild(this.faviconBg);
    this.container.addChild(this.faviconText);
    if (this.faviconSprite) this.container.addChild(this.faviconSprite);
    this.container.addChild(this.textContainer);
    this.textContainer.addChild(this.titleText);
    this.textContainer.addChild(this.urlText);
    this.container.addChild(this.tabBadge);
    this.tabBadge.addChild(this.tabBadgeBg);
    this.tabBadge.addChild(this.tabBadgeText);
    this.container.addChild(this.pinText);
    this.container.addChild(this.audioText);
    this.container.addChild(this.tagDots);

    this.faviconText.anchor.set(0.5, 0.5);
    this.titleText.resolution = 2;
    this.urlText.resolution = 2;
    this.tabBadgeText.anchor.set(0.5, 0.5);
    this.pinText.anchor.set(1, 0);
    this.audioText.anchor.set(1, 0);
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
    detailMode: DetailMode
  ) {
    this.fonts.base = fontFamily;
    const scale = view.scale;
    const pixelSize = Math.min(model.width, model.height) * scale;
    const forceDetail =
      model.isCurrent || model.isSelected || model.isSearchFocused || model.isHoverFocused;
    let lod: LODLevel = 'full';
    if (!forceDetail && pixelSize < LOD_HIDE_PX) lod = 'hidden';
    else if (!forceDetail && pixelSize < LOD_DOT_PX) lod = 'dot';
    else if (!forceDetail && pixelSize < LOD_LOW_PX) lod = 'low';
    if (detailMode === 'low' && lod === 'full') lod = 'low';
    if (detailMode === 'dot' && lod !== 'hidden') lod = 'dot';

    const nextStyleKey = [
      model.isCurrent ? 'c' : 'n',
      model.isOpen ? 'o' : 'x',
      model.isSelected ? 's' : 'n',
      model.isPreview ? 'p' : 'n',
      model.isSearchMatch ? 'm' : 'n',
      model.isSearchFocused ? 'f' : 'n',
      model.isHoverFocused ? 'h' : 'n',
      model.tabState?.sound.muted ? 'u' : 'n',
      model.display.dimClosedNodes && !model.isOpen ? 'd' : 'n',
    ].join('');

    const title = model.node.data.title || 'Untitled';
    const url = model.node.data.url ? formatUrl(model.node.data.url) : '';
    const textKey = `${title}|${url}|${model.display.titleTruncation}`;
    const tagKey =
      model.display.showTagDots && model.node.data.tags?.length
        ? model.node.data.tags.join(',')
        : '';

    const themeChanged = this.state.themeVersion !== themeVersion;
    const needsStyleUpdate = themeChanged || this.state.styleKey !== nextStyleKey || this.state.lod !== lod;
    const needsTextUpdate = themeChanged || this.state.textKey !== textKey || this.state.lod !== lod;
    const needsTagUpdate = themeChanged || this.state.tagKey !== tagKey || this.state.lod !== lod;

    this.state = { lod, styleKey: nextStyleKey, textKey, tagKey, themeVersion };

    this.container.visible = lod !== 'hidden';
    if (lod === 'hidden') return;

    this.container.alpha = model.isSearchDimmed ? 0.3 : 1;
    this.container.position.set(model.x - origin.x, model.y - origin.y);
    this.container.zIndex = computeZIndex(model);

    if (needsStyleUpdate) {
      this.drawBackground(model, theme, lod);
    }

    if (needsTextUpdate) {
      this.updateText(model, theme, lod, fontFamily);
    }

    if (needsTagUpdate) {
      this.updateTags(model, theme, lod);
    }

    this.updateBadges(model, theme, lod);
  }

  private drawBackground(
    model: NodeRenderModel,
    theme: ReturnType<typeof readGraphTheme>,
    lod: LODLevel
  ) {
    const isClosed = model.display.dimClosedNodes && !model.isOpen;
    const isActive = model.isCurrent && !isClosed;
    const isSelected = model.isSelected || model.isSearchMatch || model.isSearchFocused;
    const isPreview = model.isPreview && !model.isSelected;
    const isHover = model.isHoverFocused;
    const isMuted = model.tabState?.sound.muted ?? false;

    const backgroundColor = isClosed
      ? theme.closed.background
      : isActive
        ? theme.active.background
        : theme.surfaceContainer;
    let borderColor = isClosed ? theme.closed.border : isActive ? theme.active.border : theme.outline;
    let borderWidth = isActive ? 2 : 1;

    if (isMuted) {
      borderColor = 0xdc3545;
      borderWidth = 2;
    } else if (isSelected || isHover || isPreview) {
      borderColor = theme.primary;
      borderWidth = 2;
    }

    this.background.clear();
    const radius = NODE_RADIUS;
    this.background.roundRect(0, 0, model.width, model.height, radius);
    this.background.fill({ color: backgroundColor, alpha: 1 });
    if (borderWidth > 0) {
      this.background.stroke({ width: borderWidth, color: borderColor, alignment: 0.5 });
    }

    this.fallbackDot.clear();

    if (isPreview) {
      this.background.setStrokeStyle({ width: 2, color: borderColor, alignment: 0.5 });
      this.background.beginPath();
      drawDashedRect(this.background, 0, 0, model.width, model.height, 6, 4);
      this.background.stroke();
    }
  }

  private updateText(
    model: NodeRenderModel,
    theme: ReturnType<typeof readGraphTheme>,
    lod: LODLevel,
    fontFamily: string
  ) {
    const showFull = lod === 'full';
    const showLow = lod === 'low';
    const showFavicon = model.display.showFavicons && (showFull || showLow);
    const showUrls = model.display.showUrls && showFull;
    const showTitle = showFull || showLow;
    const isClosed = model.display.dimClosedNodes && !model.isOpen;
    const isActive = model.isCurrent && !isClosed;

    const titleColor = isClosed
      ? theme.closed.title
      : isActive
        ? theme.active.title
        : theme.onSurface;
    const urlColor = isClosed
      ? theme.closed.url
      : isActive
        ? theme.active.url
        : theme.onSurfaceVariant;

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

    this.faviconBg.visible = showFavicon;
    this.faviconText.visible = showFavicon;
    if (showFavicon) {
      const faviconX = NODE_PADDING_X;
      const faviconY = (model.height - FAVICON_SIZE) / 2;
      this.faviconBg.clear();
      this.faviconBg.roundRect(faviconX, faviconY, FAVICON_SIZE, FAVICON_SIZE, 6);
      this.faviconBg.fill({ color: theme.surfaceContainerHigh, alpha: 1 });
      this.faviconText.style.fontFamily = fontFamily;
      this.faviconText.style.fontSize = 14;
      this.faviconText.style.fill = theme.onSurfaceVariant;
      const faviconUrl = model.node.data.favicon;
      this.latestFaviconCandidate = faviconUrl ?? null;
      if (faviconUrl && isSafeFavicon(faviconUrl)) {
        const cachedTexture = getCachedFaviconTexture(faviconUrl);
        if (cachedTexture) {
          this.applyFaviconTexture(cachedTexture, faviconUrl, faviconX, faviconY);
        } else {
          this.requestFaviconLoad(faviconUrl);
          if (this.faviconSprite) this.faviconSprite.visible = false;
          this.faviconUrl = null;
          this.faviconText.text = '🌐';
          this.faviconText.position.set(faviconX + FAVICON_SIZE / 2, faviconY + FAVICON_SIZE / 2);
        }
      } else {
        if (this.faviconSprite) this.faviconSprite.visible = false;
        this.faviconUrl = null;
        this.faviconText.text = '🌐';
        this.faviconText.position.set(faviconX + FAVICON_SIZE / 2, faviconY + FAVICON_SIZE / 2);
      }
    } else {
      if (this.faviconSprite) this.faviconSprite.visible = false;
      this.faviconText.text = '';
    }
  }

  private applyFaviconTexture(
    texture: PIXI.Texture,
    faviconUrl: string,
    faviconX: number,
    faviconY: number
  ) {
    this.faviconUrl = faviconUrl;
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
    this.faviconText.text = '';
    this.faviconText.visible = false;
  }

  private requestFaviconLoad(faviconUrl: string) {
    if (this.pendingFaviconUrl === faviconUrl) return;
    this.pendingFaviconUrl = faviconUrl;
    void loadFaviconTexture(faviconUrl).then((texture) => {
      if (this.destroyed || this.latestFaviconCandidate !== faviconUrl) {
        this.pendingFaviconUrl = null;
        return;
      }
      if (texture) {
        this.faviconUrl = faviconUrl;
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
    const showLow = lod === 'low';
    const showBadges = showFull || showLow;

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

    this.pinText.visible = showPin;
    this.audioText.visible = showAudio;

    if (showPin) {
      this.pinText.style.fontFamily = this.fonts.base;
      this.pinText.style.fontSize = 12;
      this.pinText.style.fill = theme.onSurfaceVariant;
      this.pinText.position.set(model.width - 6, 4);
    }
    if (showAudio) {
      const icon = model.tabState?.sound.muted ? '🔇' : '🔊';
      this.audioText.text = icon;
      this.audioText.style.fontFamily = this.fonts.base;
      this.audioText.style.fontSize = 12;
      this.audioText.style.fill = theme.primary;
      const offset = showPin ? 18 : 6;
      this.audioText.position.set(model.width - offset, 4);
    }
  }

  private updateTags(
    model: NodeRenderModel,
    theme: ReturnType<typeof readGraphTheme>,
    lod: LODLevel
  ) {
    const show = lod === 'full' && model.display.showTagDots;
    this.tagDots.visible = show;
    this.tagDots.removeChildren();
    if (!show) return;
    const tags = model.node.data.tags ?? [];
    const maxTags = Math.min(tags.length, 4);
    if (maxTags === 0) return;
    const dotSize = 10;
    const gap = 3;
    let x = model.width - dotSize - 4;
    const y = model.height - dotSize - 4;
    for (let i = 0; i < maxTags; i += 1) {
      const tagId = tags[i];
      if (!tagId) continue;
      const tagPreset = model.tagDefs[tagId];
      if (!tagPreset) continue;
      const dot = new PIXI.Graphics();
      dot.circle(0, 0, dotSize / 2);
      dot.fill({ color: safeColor(tagPreset.color, theme.primary), alpha: 1 });
      dot.position.set(x + dotSize / 2, y + dotSize / 2);
      this.tagDots.addChild(dot);
      x -= dotSize + gap;
    }
  }
}

export class GraphPixiRenderer {
  private readonly host: HTMLDivElement;
  private readonly app: PIXI.Application;
  private readonly world = new PIXI.Container();
  private readonly connectionLayer = new PIXI.Graphics();
  private readonly pathLayer = new PIXI.Graphics();
  private readonly nodeLayer = new PIXI.Container();
  private readonly nodeMap = new Map<NodeId, NodeVisual>();
  private readonly nodeData = new Map<NodeId, NodeRenderModel>();
  private index = new SpatialIndex<NodeId>(300);
  private connections: ConnectionSegment[] = [];
  private view: ViewState = { translateX: 0, translateY: 0, scale: 1 };
  private data: RenderData = { nodes: [], connections: [], nodeWidth: 180, nodeHeight: 60, showConnections: true };
  private theme = readGraphTheme({ host: document.body });
  private themeVersion = 0;
  private fontFamily = '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
  private detailMode: DetailMode = 'full';
  private origin = { x: 0, y: 0 };
  private needsRender = false;
  private destroyed = false;
  private isReady = false;
  private canvas: HTMLCanvasElement | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly requestRender = () => {
    if (this.destroyed) return;
    this.invalidateVisible();
  };

  constructor(host: HTMLDivElement) {
    this.host = host;
    this.app = new PIXI.Application();
    this.app.stage.addChild(this.world);
    this.world.addChild(this.connectionLayer);
    this.world.addChild(this.pathLayer);
    this.world.addChild(this.nodeLayer);
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
        resizeTo: this.host,
        powerPreference: 'high-performance',
      });
      if (this.destroyed) {
        this.app.destroy(true, { children: true });
        return;
      }
      const canvas = this.app.canvas as HTMLCanvasElement;
      this.canvas = canvas;
      this.host.appendChild(canvas);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      this.app.ticker?.stop();
      this.isReady = true;
      this.updateOrigin();
      this.updateWorldTransform();
      this.refreshTheme();
    } catch (error) {
      console.error('Failed to initialize Pixi renderer:', error);
    }
  }

  destroy() {
    this.destroyed = true;
    this.nodeMap.forEach((visual) => visual.destroy());
    this.nodeMap.clear();
    this.nodeData.clear();
    this.index.clear();
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

  refreshTheme() {
    this.theme = readGraphTheme({ host: this.host });
    const style = getComputedStyle(this.host);
    this.fontFamily = style.fontFamily || this.fontFamily;
    this.themeVersion += 1;
    if (!this.isReady) return;
    this.invalidateAll();
  }

  setDetailMode(mode: DetailMode) {
    if (this.detailMode === mode) return;
    this.detailMode = mode;
    this.invalidateAll();
  }

  setData(data: RenderData) {
    this.data = data;
    this.connections = data.connections;
    this.nodeData.clear();
    this.index = new SpatialIndex<NodeId>(Math.max(data.nodeWidth, data.nodeHeight) * 3);
    const ids = new Set<NodeId>();
    data.nodes.forEach((node) => {
      this.nodeData.set(node.id, node);
      ids.add(node.id);
      const rect = {
        minX: node.x,
        minY: node.y,
        maxX: node.x + node.width,
        maxY: node.y + node.height,
      };
      this.index.insert(node.id, rect);
    });
    for (const [id, visual] of this.nodeMap.entries()) {
      if (!ids.has(id)) {
        visual.destroy();
        this.nodeMap.delete(id);
      }
    }
    this.invalidateAll();
  }

  setView(view: ViewState) {
    this.view = view;
    if (!this.isReady) return;
    this.updateOrigin();
    this.updateWorldTransform();
    this.invalidateVisible();
  }

  hitTestScreen(screenX: number, screenY: number): NodeId | null {
    const world = this.screenToWorld(screenX, screenY);
    return this.hitTestWorld(world.x, world.y);
  }

  screenToWorld(screenX: number, screenY: number) {
    return {
      x: (screenX - this.view.translateX) / this.view.scale,
      y: (screenY - this.view.translateY) / this.view.scale,
    };
  }

  private hitTestWorld(worldX: number, worldY: number): NodeId | null {
    const candidates = this.index.query({
      minX: worldX,
      maxX: worldX,
      minY: worldY,
      maxY: worldY,
    });
    if (candidates.size === 0) return null;
    const ordered = Array.from(this.nodeData.keys());
    for (let i = ordered.length - 1; i >= 0; i -= 1) {
      const id = ordered[i];
      if (!id || !candidates.has(id)) continue;
      const node = this.nodeData.get(id);
      if (!node) continue;
      if (
        worldX >= node.x &&
        worldX <= node.x + node.width &&
        worldY >= node.y &&
        worldY <= node.y + node.height
      ) {
        return id;
      }
    }
    return null;
  }

  private invalidateAll() {
    if (!this.isReady) return;
    this.needsRender = true;
    this.updateVisible();
    this.render();
  }

  private invalidateVisible() {
    if (!this.isReady) return;
    this.needsRender = true;
    this.updateVisible();
    this.render();
  }

  private render() {
    if (!this.isReady) return;
    if (!this.needsRender) return;
    this.needsRender = false;
    this.app.renderer.render(this.app.stage);
  }

  private updateOrigin() {
    const rect = this.getViewRect();
    const desiredX = Math.round(rect.minX + rect.width / 2);
    const desiredY = Math.round(rect.minY + rect.height / 2);
    const threshold = Math.max(rect.width, rect.height);
    if (
      Math.abs(desiredX - this.origin.x) > threshold ||
      Math.abs(desiredY - this.origin.y) > threshold
    ) {
      this.origin = { x: desiredX, y: desiredY };
    }
  }

  private updateWorldTransform() {
    this.world.scale.set(this.view.scale);
    this.world.position.set(
      this.view.translateX + this.origin.x * this.view.scale,
      this.view.translateY + this.origin.y * this.view.scale
    );
  }

  private updateVisible() {
    const viewRect = this.getViewRect();
    const padding = 200 / this.view.scale;
    const paddedRect = {
      minX: viewRect.minX - padding,
      minY: viewRect.minY - padding,
      maxX: viewRect.maxX + padding,
      maxY: viewRect.maxY + padding,
    };
    const visibleIds = this.index.query(paddedRect);
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
        this.detailMode
      );
    });
    for (const [id, visual] of this.nodeMap.entries()) {
      if (!visibleIds.has(id)) {
        visual.container.visible = false;
      }
    }
    this.nodeLayer.sortDirty = true;
    this.updateConnections(paddedRect);
  }

  private updateConnections(viewRect: { minX: number; minY: number; maxX: number; maxY: number }) {
    this.connectionLayer.clear();
    this.pathLayer.clear();
    if (!this.data.showConnections || this.detailMode !== 'full') return;
    const baseColor = this.theme.connection.base;
    const pathColor = this.theme.connection.path;
    const baseWidth = 2 / this.view.scale;
    const pathWidth = 2.5 / this.view.scale;
    this.connectionLayer.setStrokeStyle({ width: baseWidth, color: baseColor, alpha: 0.6 });
    this.pathLayer.setStrokeStyle({ width: pathWidth, color: pathColor, alpha: 1 });

    this.connections.forEach((conn) => {
      if (!intersects(conn.bounds, viewRect)) return;
      const layer = conn.onPath ? this.pathLayer : this.connectionLayer;
      const startX = conn.start.x - this.origin.x;
      const startY = conn.start.y - this.origin.y;
      const cp1X = conn.cp1.x - this.origin.x;
      const cp1Y = conn.cp1.y - this.origin.y;
      const cp2X = conn.cp2.x - this.origin.x;
      const cp2Y = conn.cp2.y - this.origin.y;
      const endX = conn.end.x - this.origin.x;
      const endY = conn.end.y - this.origin.y;
      layer.moveTo(startX, startY);
      layer.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
    });
    if (this.connections.length > 0) {
      this.connectionLayer.stroke();
      this.pathLayer.stroke();
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

function drawDashedRect(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  dash: number,
  gap: number
) {
  const segmentsX = Math.floor(width / (dash + gap));
  const segmentsY = Math.floor(height / (dash + gap));
  for (let i = 0; i < segmentsX; i += 1) {
    const startX = x + i * (dash + gap);
    graphics.moveTo(startX, y);
    graphics.lineTo(Math.min(startX + dash, x + width), y);
    graphics.moveTo(startX, y + height);
    graphics.lineTo(Math.min(startX + dash, x + width), y + height);
  }
  for (let i = 0; i < segmentsY; i += 1) {
    const startY = y + i * (dash + gap);
    graphics.moveTo(x, startY);
    graphics.lineTo(x, Math.min(startY + dash, y + height));
    graphics.moveTo(x + width, startY);
    graphics.lineTo(x + width, Math.min(startY + dash, y + height));
  }
}

function isSafeFavicon(url: string): boolean {
  if (url.startsWith('data:') || url.startsWith('blob:')) return true;
  if (url.startsWith('http://') || url.startsWith('https://')) return true;
  if (url.startsWith('chrome-extension://')) {
    const base = getExtensionBaseUrl();
    return base ? url.startsWith(base) : false;
  }
  return false;
}

function computeZIndex(model: NodeRenderModel): number {
  if (model.isSearchFocused) return 40;
  if (model.isSelected) return 30;
  if (model.isSearchMatch) return 25;
  if (model.isHoverFocused) return 20;
  if (model.isCurrent) return 15;
  return 1;
}

function safeColor(value: string, fallback: number): number {
  try {
    return PIXI.Color.shared.setValue(value).toNumber();
  } catch {
    return fallback;
  }
}

function getCachedFaviconTexture(url: string): PIXI.Texture | null {
  return faviconTextureCache.get(url) ?? null;
}

function loadFaviconTexture(url: string): Promise<PIXI.Texture | null> {
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
        faviconTextureCache.set(url, texture);
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
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL('');
    }
  } catch {
    // ignore
  }
  return null;
}
