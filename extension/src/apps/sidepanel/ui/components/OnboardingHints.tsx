import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { hasSeenOnboardingItem } from "@shared/config/storage-items.js";

type HintDef = {
  targetSelector: string;
  label: string;
};

const HINTS: HintDef[] = [
  { targetSelector: ".search-orb", label: "Search your pages" },
  { targetSelector: "#treesBtn", label: "Switch between trees" },
  { targetSelector: "#tagFilterBtn", label: "Filter by tags" },
];

type HintPosition = { top: number; left: number; width: number };

export default function OnboardingHints() {
  const [visible, setVisible] = useState(false);
  const [positions, setPositions] = useState<HintPosition[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Check storage flag on mount
  useEffect(() => {
    let cancelled = false;
    hasSeenOnboardingItem
      .getValue()
      .then((seen) => {
        if (!cancelled && !seen) setVisible(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Position hints relative to targets
  useLayoutEffect(() => {
    if (!visible) return;
    // Slight delay to ensure FloatingControls has rendered
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
      className="onboarding-hints"
      style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "auto" }}
      onClick={handleDismiss}
    >
      {/* Semi-transparent backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />

      {HINTS.map((hint, i) => {
        const pos = positions[i];
        if (!pos || pos.width === 0) return null;
        return (
          <div
            key={hint.targetSelector}
            className="onboarding-hint"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translateX(-50%)",
              background: "var(--color-bg-primary, #1a1a2e)",
              border: "1px solid var(--color-border, rgba(128,128,128,0.25))",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "11px",
              color: "var(--color-text-primary, #e0e0e0)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>{hint.label}</span>
          </div>
        );
      })}

      {/* Single "Got it" button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "8px 24px",
          fontSize: "13px",
          borderRadius: "8px",
          border: "1px solid var(--color-border, rgba(128,128,128,0.25))",
          background: "var(--color-bg-secondary, #2a2a3e)",
          color: "var(--color-text-primary, #e0e0e0)",
          cursor: "pointer",
          zIndex: 10000,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        Got it
      </button>
    </div>
  );
}
