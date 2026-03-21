import { useEffect, useRef } from "react";
import { useStore, type OverlayEffects, type OverlayKind } from "./store.js";

export type OverlayEffectInput = {
  lod?: boolean;
  blur?: boolean;
  kind: OverlayKind;
};

let overlayIdCounter = 0;

const nextOverlayId = () => {
  overlayIdCounter += 1;
  return `overlay-${overlayIdCounter}`;
};

export const useOverlayEffects = (open: boolean, effects: OverlayEffectInput) => {
  const registerOverlay = useStore((state) => state.registerOverlay);
  const unregisterOverlay = useStore((state) => state.unregisterOverlay);
  const overlayIdRef = useRef<string | null>(null);

  // eslint-disable-next-line react-hooks/refs -- sync prop to ref for stable callback access
  if (!overlayIdRef.current) {
    overlayIdRef.current = nextOverlayId();
  }

  const lod = Boolean(effects.lod);
  const blur = Boolean(effects.blur);
  const kind = effects.kind;

  useEffect(() => {
    if (!open) return;
    const payload: OverlayEffects = { lod, blur, kind };
    registerOverlay(overlayIdRef.current as string, payload);
    return () => unregisterOverlay(overlayIdRef.current as string);
  }, [blur, kind, lod, open, registerOverlay, unregisterOverlay]);
};
