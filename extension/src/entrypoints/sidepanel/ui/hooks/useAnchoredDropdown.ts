import { useCallback, useEffect, useLayoutEffect, type RefObject } from "react";

type AnchoredDropdownOptions = {
  open: boolean;
  dropdownRef: RefObject<HTMLElement | null>;
  padding?: number;
};

export function useAnchoredDropdown({
  open,
  dropdownRef,
  padding = 8,
}: AnchoredDropdownOptions): void {
  const updateShift = useCallback(() => {
    const dropdown = dropdownRef.current;
    if (!dropdown || typeof window === "undefined") return;
    dropdown.style.setProperty("--dropdown-shift", "0px");
    const rect = dropdown.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const safe = padding;
    let shift = 0;
    if (rect.right > viewportWidth - safe) {
      shift -= rect.right - (viewportWidth - safe);
    }
    if (rect.left + shift < safe) {
      shift += safe - (rect.left + shift);
    }
    dropdown.style.setProperty("--dropdown-shift", `${shift}px`);
  }, [dropdownRef, padding]);

  useLayoutEffect(() => {
    if (!open) return;
    updateShift();
  }, [open, updateShift]);

  useEffect(() => {
    const dropdown = dropdownRef.current;
    if (!open || !dropdown || typeof window === "undefined") return;
    const observer = new ResizeObserver(() => updateShift());
    observer.observe(dropdown);
    window.addEventListener("resize", updateShift);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateShift);
    };
  }, [open, updateShift, dropdownRef]);
}
