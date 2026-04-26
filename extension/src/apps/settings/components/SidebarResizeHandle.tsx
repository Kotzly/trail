import { useCallback, useRef, useState } from "react";
import { useSidebar } from "@ui/components/ui/sidebar";
import { cn } from "@ui/lib/utils";

const STORAGE_KEY = "trail-settings-sidebar-width";
const MIN_REM = 12;
const MAX_REM = 28;
const COLLAPSE_THRESHOLD_REM = 10;
const DRAG_THRESHOLD_PX = 3;

function writeStoredWidth(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore quota / disabled storage */
  }
}

function getWrapper(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-slot='sidebar-wrapper']");
}

function getRemPx(): number {
  const fontSize = getComputedStyle(document.documentElement).fontSize;
  const px = parseFloat(fontSize);
  return Number.isFinite(px) && px > 0 ? px : 16;
}

export function SidebarResizeHandle() {
  const { state, setOpen, toggleSidebar, isMobile } = useSidebar();
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthPxRef = useRef(0);
  const movedRef = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (state !== "expanded") return;
      const wrapper = getWrapper();
      if (!wrapper) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const cs = getComputedStyle(wrapper);
      const widthRaw = cs.getPropertyValue("--sidebar-width").trim();
      const remPx = getRemPx();
      const widthPx = widthRaw.endsWith("rem")
        ? parseFloat(widthRaw) * remPx
        : parseFloat(widthRaw);
      startXRef.current = e.clientX;
      startWidthPxRef.current = Number.isFinite(widthPx) ? widthPx : 14 * remPx;
      movedRef.current = false;
      setDragging(true);
    },
    [state],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragging) return;
      const dx = e.clientX - startXRef.current;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) movedRef.current = true;
      const remPx = getRemPx();
      const nextPx = startWidthPxRef.current + dx;
      const nextRem = nextPx / remPx;

      if (nextRem < COLLAPSE_THRESHOLD_REM) {
        const wrapper = getWrapper();
        if (wrapper) wrapper.style.setProperty("--sidebar-width", `${MIN_REM}rem`);
        if (state === "expanded") setOpen(false);
        return;
      }

      const clamped = Math.max(MIN_REM, Math.min(MAX_REM, nextRem));
      const wrapper = getWrapper();
      if (wrapper) wrapper.style.setProperty("--sidebar-width", `${clamped}rem`);
      if (state !== "expanded") setOpen(true);
    },
    [dragging, state, setOpen],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragging) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDragging(false);
      const wrapper = getWrapper();
      if (wrapper) {
        const final = wrapper.style.getPropertyValue("--sidebar-width").trim();
        if (final) writeStoredWidth(final);
      }
    },
    [dragging],
  );

  const onClick = useCallback(() => {
    if (movedRef.current) return;
    toggleSidebar();
  }, [toggleSidebar]);

  if (isMobile) return null;

  return (
    <button
      type="button"
      aria-label="Resize sidebar"
      title={state === "expanded" ? "Drag to resize · click to collapse" : "Click to expand"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      tabIndex={-1}
      className={cn(
        "absolute inset-y-0 z-20 hidden w-3 sm:flex",
        "group-data-[side=left]:-right-1.5 group-data-[side=right]:-left-1.5",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent",
        "hover:after:bg-sidebar-border focus-visible:after:bg-sidebar-border",
        dragging && "after:bg-sidebar-border",
        state === "expanded" ? "cursor-ew-resize" : "cursor-e-resize",
      )}
    />
  );
}
