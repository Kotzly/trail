import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { hasSeenOnboardingItem } from "@shared/config/storage-items.js";
import { Button } from "@ui/components/ui/button";

type HintDef = {
  targetSelector: string;
  label: string;
};

const HINTS: HintDef[] = [
  { targetSelector: "#searchBtn", label: "Search your pages" },
  { targetSelector: "#treesBtn", label: "Switch between trees" },
];

type HintPosition = { top: number; left: number; width: number };

export default function OnboardingHints() {
  const [visible, setVisible] = useState(false);
  const [positions, setPositions] = useState<HintPosition[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasSeenOnboardingItem
      .getValue()
      .then((seen) => {
        if (!cancelled && !seen) setVisible(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      const pos: HintPosition[] = HINTS.map((hint) => {
        const el = document.querySelector(hint.targetSelector);
        if (!el) return { top: 0, left: 0, width: 0 };
        const rect = el.getBoundingClientRect();
        return {
          top: rect.bottom + 8,
          left: rect.left + rect.width / 2,
          width: rect.width,
        };
      });
      setPositions(pos);
    }, 300);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleDismiss = () => {
    setVisible(false);
    hasSeenOnboardingItem.setValue(true).catch(() => {});
  };

  if (!visible || positions.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999]"
      onClick={handleDismiss}
    >
      <div className="absolute inset-0 bg-black/30" />

      {HINTS.map((hint, i) => {
        const pos = positions[i];
        if (!pos || pos.width === 0) return null;
        return (
          <div
            key={hint.targetSelector}
            className="fixed -translate-x-1/2 bg-popover border border-border rounded-lg px-3 py-1.5 text-[11px] text-popover-foreground whitespace-nowrap pointer-events-none shadow-md flex items-center gap-2"
            style={{ top: pos.top, left: pos.left }}
          >
            <span>{hint.label}</span>
          </div>
        );
      })}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000]">
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
