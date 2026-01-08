import { PanelState } from "../state/panel-state";
import type { NodeId } from "../../shared/types/ids";
import { navigateTo } from "../api/tree";

/**
 * Pinned dropdown controller.
 *
 * - Safe DOM building (no innerHTML injection from titles/urls)
 * - Proper add/remove event listeners (stable handler refs)
 * - Keyboard nav (Up/Down/Enter/Escape) with wrap-around
 * - Click + hover to focus
 * - Closes on outside click
 * - Graceful when pins/tree/ui not ready
 */
export class PinnedDropdownController {
  private readonly dropdownId: string;
  private readonly listId: string;
  private readonly countId: string;
  private readonly triggerId: string;

  private dropdown: HTMLElement | null = null;
  private list: HTMLElement | null = null;
  private count: HTMLElement | null = null;
  private trigger: HTMLElement | null = null;

  private openState = false;
  private focusedIndex = 0;
  private pinnedIds: NodeId[] = [];

  // stable handler refs (IMPORTANT for removeEventListener)
  private readonly onDocKeyDown = (e: KeyboardEvent) => this.handleKeydown(e);
  private readonly onDocMouseDown = (e: MouseEvent) => this.handleOutsideMouseDown(e);
  private readonly onListClick = (e: MouseEvent) => this.handleListClick(e);
  private readonly onListMouseOver = (e: MouseEvent) => this.handleListMouseOver(e);

  constructor(opts?: {
    dropdownId?: string;
    listId?: string;
    countId?: string;
    triggerId?: string; // optional element that toggles dropdown, used for outside-click exclusion
  }) {
    this.dropdownId = opts?.dropdownId ?? "pinnedDropdown";
    this.listId = opts?.listId ?? "pinnedList";
    this.countId = opts?.countId ?? "pinnedCount";
    this.triggerId = opts?.triggerId ?? "pinnedBtn";

    this.bindDom();
  }

  /** Call if your DOM is replaced / hot-reloaded. Safe to call multiple times. */
  bindDom(): void {
    this.dropdown = document.getElementById(this.dropdownId);
    this.list = document.getElementById(this.listId);
    this.count = document.getElementById(this.countId);
    this.trigger = this.triggerId ? document.getElementById(this.triggerId) : null;

    // Ensure dropdown can receive focus for accessibility (optional, but helpful)
    if (this.dropdown && !this.dropdown.hasAttribute("tabindex")) {
      this.dropdown.tabIndex = -1;
    }
  }

  isOpen(): boolean {
    return this.openState;
  }

  toggle(): void {
    if (this.openState) this.close();
    else this.open();
  }

  open(): void {
    this.bindDom();
    if (!this.dropdown || !this.list || !this.count) return;

    if (!PanelState.pins) {
      console.warn("PinnedDropdownController: PanelState.pins not initialized");
      return;
    }

    this.openState = true;
    this.dropdown.classList.remove("hidden");

    this.render();
    this.attachListeners();

    // focus for keyboard nav
    this.dropdown.focus({ preventScroll: true });
  }

  close(): void {
    this.bindDom();
    if (!this.dropdown) return;

    if (!this.openState) {
      // still ensure hidden if someone calls close() twice
      this.dropdown.classList.add("hidden");
      this.detachListeners();
      return;
    }

    this.openState = false;
    this.dropdown.classList.add("hidden");
    this.detachListeners();

    // reset view state
    this.pinnedIds = [];
    this.focusedIndex = 0;

    // optional: clear focus styles
    if (this.list) {
      this.list.querySelectorAll(".pinned-dropdown-item.focused").forEach(el => {
        el.classList.remove("focused");
      });
    }
  }

  /** Re-render if dropdown open (e.g. pins changed / tree updated). */
  refresh(): void {
    if (!this.openState) return;
    this.render();
  }

  // ---------------------------
  // Rendering
  // ---------------------------

  private render(): void {
    if (!this.dropdown || !this.list || !this.count) return;
    if (!PanelState.pins) return;

    const pinsSet = PanelState.pins.pinned;
    const pins = Array.from(pinsSet);

    this.count.textContent = String(pins.length);

    // Build pinnedIds (used for keyboard nav + enter)
    this.pinnedIds = pins.map(n => n.id as NodeId);

    // Clamp focus
    if (pins.length === 0) this.focusedIndex = 0;
    else this.focusedIndex = Math.min(this.focusedIndex, pins.length - 1);

    // Clear list
    this.list.textContent = "";

    if (pins.length === 0) {
      const empty = document.createElement("div");
      empty.className = "pinned-dropdown-empty";
      empty.textContent = "No pinned pages";
      this.list.appendChild(empty);
      return;
    }

    // Render items
    pins.forEach((node, idx) => {
      const item = document.createElement("div");
      item.className = "pinned-dropdown-item";
      if (idx === this.focusedIndex) item.classList.add("focused");
      item.dataset.nodeId = String(node.id);

      // favicon
      if (node.favicon) {
        const img = document.createElement("img");
        img.className = "pinned-dropdown-item-favicon";
        img.alt = "";
        img.src = node.favicon;
        // fallback if favicon fails
        img.onerror = () => {
          const placeholder = document.createElement("div");
          placeholder.className = "pinned-dropdown-item-favicon placeholder";
          placeholder.textContent = "📌";
          img.replaceWith(placeholder);
        };
        item.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "pinned-dropdown-item-favicon placeholder";
        placeholder.textContent = "📌";
        item.appendChild(placeholder);
      }

      // info
      const info = document.createElement("div");
      info.className = "pinned-dropdown-item-info";

      const title = document.createElement("div");
      title.className = "pinned-dropdown-item-title";
      title.textContent = node.title || "Untitled";

      const urlLine = document.createElement("div");
      urlLine.className = "pinned-dropdown-item-url";
      urlLine.textContent = this.safeDomain(node.url);

      info.appendChild(title);
      info.appendChild(urlLine);
      item.appendChild(info);

      this.list!.appendChild(item);
    });

    // Ensure focused item is visible
    this.scrollFocusedIntoView();
  }

  private safeDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url || "";
    }
  }

  // ---------------------------
  // Listeners
  // ---------------------------

  private attachListeners(): void {
    if (!this.dropdown || !this.list) return;

    // capture key events even if focus moves inside dropdown
    document.addEventListener("keydown", this.onDocKeyDown, true);

    // close on outside click (mousedown feels snappier than click)
    document.addEventListener("mousedown", this.onDocMouseDown, true);

    // delegation on list
    this.list.addEventListener("click", this.onListClick);
    this.list.addEventListener("mouseover", this.onListMouseOver);
  }

  private detachListeners(): void {
    if (this.list) {
      this.list.removeEventListener("click", this.onListClick);
      this.list.removeEventListener("mouseover", this.onListMouseOver);
    }
    document.removeEventListener("keydown", this.onDocKeyDown, true);
    document.removeEventListener("mousedown", this.onDocMouseDown, true);
  }

  private handleOutsideMouseDown(e: MouseEvent): void {
    if (!this.openState) return;
    const target = e.target as Node | null;
    if (!target) return;

    // if click is inside dropdown => ignore
    if (this.dropdown && this.dropdown.contains(target)) return;

    // if click is on trigger (toggle button) => ignore (your trigger handler will toggle)
    if (this.trigger && this.trigger.contains(target)) return;

    this.close();
  }

  private handleListClick(e: MouseEvent): void {
    if (!this.openState || !this.list) return;

    const target = e.target as HTMLElement | null;
    const item = target?.closest(".pinned-dropdown-item") as HTMLElement | null;
    if (!item) return;

    const nodeId = this.parseNodeId(item.dataset.nodeId);
    if (nodeId === null) return;

    // focus that item
    this.setFocusedByNodeId(nodeId);

    // navigate
    void this.navigateFocused();
  }

  private handleListMouseOver(e: MouseEvent): void {
    if (!this.openState || !this.list) return;

    const target = e.target as HTMLElement | null;
    const item = target?.closest(".pinned-dropdown-item") as HTMLElement | null;
    if (!item) return;

    const nodeId = this.parseNodeId(item.dataset.nodeId);
    if (nodeId === null) return;

    this.setFocusedByNodeId(nodeId);
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (!this.openState) return;

    // If user is typing in an input/textarea/contenteditable, don't hijack arrows/enter.
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName?.toLowerCase();
    const isTypingTarget =
      tag === "input" ||
      tag === "textarea" ||
      (el instanceof HTMLElement && el.isContentEditable);
    if (isTypingTarget) return;

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        this.close();
        return;

      case "ArrowUp":
        e.preventDefault();
        this.moveFocus(-1);
        return;

      case "ArrowDown":
        e.preventDefault();
        this.moveFocus(1);
        return;

      case "Enter":
        e.preventDefault();
        void this.navigateFocused();
        return;

      default:
        return;
    }
  }

  // ---------------------------
  // Focus + navigation
  // ---------------------------

  private moveFocus(delta: number): void {
    if (!this.list) return;
    const total = this.pinnedIds.length;
    if (total === 0) return;

    const next = (this.focusedIndex + delta + total) % total;
    this.setFocusedIndex(next);
  }

  private setFocusedByNodeId(nodeId: NodeId): void {
    const idx = this.pinnedIds.findIndex(id => id === nodeId);
    if (idx >= 0) this.setFocusedIndex(idx);
  }

  private setFocusedIndex(index: number): void {
    if (!this.list) return;
    const total = this.pinnedIds.length;
    if (total === 0) return;

    const clamped = Math.max(0, Math.min(index, total - 1));
    this.focusedIndex = clamped;

    this.list.querySelectorAll(".pinned-dropdown-item.focused").forEach(el => {
      el.classList.remove("focused");
    });

    const focusedNodeId = this.pinnedIds[this.focusedIndex];
    if (focusedNodeId === undefined) return;

    const item = this.list.querySelector(
      `.pinned-dropdown-item[data-node-id="${focusedNodeId}"]`
    ) as HTMLElement | null;

    if (item) {
      item.classList.add("focused");
      item.scrollIntoView({ block: "nearest" });
    }
  }

  private scrollFocusedIntoView(): void {
    if (!this.list) return;
    const focusedNodeId = this.pinnedIds[this.focusedIndex];
    if (focusedNodeId === undefined) return;
    const item = this.list.querySelector(
      `.pinned-dropdown-item[data-node-id="${focusedNodeId}"]`
    ) as HTMLElement | null;
    item?.scrollIntoView({ block: "nearest" });
  }

  private async navigateFocused(): Promise<void> {
    const nodeId = this.pinnedIds[this.focusedIndex];
    if (nodeId === undefined) return;

    const node = PanelState.tree?.findNodeByIdDFS(nodeId);
    if (!node) {
      // tree might have changed; refresh once
      this.refresh();
      return;
    }

    try {
      await navigateTo(node);
    } catch (err) {
      console.error("PinnedDropdownController: navigateTo failed", err);
    } finally {
      this.close();
    }
  }

  private parseNodeId(raw: string | undefined): NodeId | null {
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return null;
    return n as NodeId;
  }
}
