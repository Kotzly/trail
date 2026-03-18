import { useRef, useCallback, useEffect } from 'react';

const DRILLDOWN_TTL_MS = 3 * 60 * 1000; // 3 minutes

export interface DrilldownScope {
  treeId: string;
  treeName: string;
}

export interface DrilldownMemory {
  save: (scope: DrilldownScope | null) => void;
  restore: () => DrilldownScope | null;
  clear: () => void;
}

/**
 * Remembers the last drilldown scope across open/close cycles.
 *
 * On close, call `save(currentScope)` — the scope is held for 3 minutes.
 * On open, call `restore()` — returns the saved scope (or null if expired)
 * and clears it so it won't be applied again.
 */
export function useDrilldownMemory(): DrilldownMemory {
  const savedScope = useRef<DrilldownScope | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    savedScope.current = null;
  }, []);

  const save = useCallback((scope: DrilldownScope | null) => {
    clear();
    if (scope) {
      savedScope.current = scope;
      timerRef.current = setTimeout(clear, DRILLDOWN_TTL_MS);
    }
  }, [clear]);

  const restore = useCallback(() => {
    const scope = savedScope.current;
    clear();
    return scope;
  }, [clear]);

  useEffect(() => clear, [clear]); // cleanup on unmount

  return { save, restore, clear };
}
