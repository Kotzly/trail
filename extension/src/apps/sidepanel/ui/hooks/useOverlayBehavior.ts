import { useEffect, useRef, type RefObject } from "react";

type UseOverlayBehaviorOptions = {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
  skipEscWhenEditing?: boolean;
};

export function useOverlayBehavior({
  open,
  onClose,
  containerRef,
  triggerRef,
  skipEscWhenEditing = false,
}: UseOverlayBehaviorOptions): void {
  const prevOpenRef = useRef(false);

  // Esc keydown + click-outside mousedown (both capture phase)
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (skipEscWhenEditing) {
        const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
      }
      event.preventDefault();
      onClose();
    };

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("mousedown", onMouseDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [open, onClose, containerRef, triggerRef, skipEscWhenEditing]);

  // Focus return: when open transitions from true to false, focus the trigger
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (wasOpen && !open) {
      triggerRef.current?.focus();
    }
  }, [open, triggerRef]);

  // Inert management: set inert on sibling floating-islands when open
  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;

    const ownIsland = container.closest(".floating-island");
    const controlsRoot = container.closest(".floating-controls");
    if (!controlsRoot) return;

    const allIslands = controlsRoot.querySelectorAll(".floating-island");
    const inertedElements: Element[] = [];

    allIslands.forEach((island) => {
      if (island === ownIsland) return;
      island.setAttribute("inert", "");
      inertedElements.push(island);
    });

    return () => {
      inertedElements.forEach((el) => {
        el.removeAttribute("inert");
      });
    };
  }, [open, containerRef]);
}
