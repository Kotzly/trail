import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings } from "../../api/settings.js";
import { getFlags } from "../../api/flags.js";
import { getTreeState, getTrees } from "../../api/tree.js";
import { getTagDefs } from "../../api/tags.js";
import { getCommandState } from "../../api/commands.js";
import { isMac } from "@shared/utils/platform.js";
import { useStore, type MetaKeyPair } from "../state/store.js";
import { applyTheme } from "../shared/apply-theme.js";
import { graphProfiler, STARTUP_T0 } from "@features/graph/graph/render/graph-profiler.js";
import { fireAndForget } from "../../api/background.js";
import { RPC_METHOD } from "@shared/rpc/contracts.js";

export type BootstrapStatus = "loading" | "degraded" | "ready";

const BOOTSTRAP_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Bootstrap timed out")), ms),
    ),
  ]);
}

export function useBootstrap(): {
  bootstrapStatus: BootstrapStatus;
  retryBootstrap: () => void;
} {
  const bootstrapGraph = useStore((state) => state.bootstrapGraph);
  const setPlatformMeta = useStore((state) => state.setPlatformMeta);
  const setCommandState = useStore((state) => state.setCommandState);
  const setEditorMode = useStore((state) => state.setEditorMode);
  const setSettings = useStore((state) => state.setSettings);
  const setFlags = useStore((state) => state.setFlags);
  const setTagDefs = useStore((state) => state.setTagDefs);
  const setTrees = useStore((state) => state.setTrees);

  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus>("loading");
  const [retryCount, setRetryCount] = useState(0);
  const autoRetryScheduled = useRef(false);
  const bootstrapInFlight = useRef(false);

  const retryBootstrap = useCallback(() => {
    setBootstrapStatus("loading");
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (bootstrapInFlight.current) return;
      bootstrapInFlight.current = true;

      // ---- Critical path: settings + tree only ----
      try {
        const [settings, treeState, flags] = await withTimeout(
          Promise.all([getSettings(), getTreeState(), getFlags()]),
          BOOTSTRAP_TIMEOUT_MS,
        );
        if (!mounted) return;

        bootstrapGraph(settings, treeState);
        setFlags(flags);
        setSettings(settings);
        applyTheme(settings.theme, settings.customTheme);

        // Restore editor mode if it was active before the sidepanel was closed
        if (treeState.editorMode?.active) {
          setEditorMode(treeState.editorMode);
        }

        setBootstrapStatus("ready");
        graphProfiler.recordStartup("sidepanelPaintMs", performance.now() - STARTUP_T0);
      } catch (error) {
        console.error(
          "[bootstrap] Critical fetch failed:",
          error,
        );

        if (!mounted) {
          bootstrapInFlight.current = false;
          return;
        }

        // First failure (retryCount === 0 and no auto-retry yet): schedule auto-retry after 5s
        if (retryCount === 0 && !autoRetryScheduled.current) {
          autoRetryScheduled.current = true;
          setTimeout(() => {
            if (mounted) {
              setRetryCount(1);
            }
          }, 5000);
          bootstrapInFlight.current = false;
          return;
        }

        // Second or later failure: show degraded state
        setBootstrapStatus("degraded");
        bootstrapInFlight.current = false;
        return;
      }

      // ---- Deferred: non-blocking fetches after first paint ----
      if (!mounted) return;

      // Pre-warm spotlight search index in background (fire-and-forget)
      fireAndForget({ type: RPC_METHOD.SPOTLIGHT_BOOTSTRAP });

      // Fire all deferred fetches in parallel, each with independent error handling
      const deferredPromises = [
        getTagDefs()
          .then((defs) => {
            if (mounted) setTagDefs(defs);
          })
          .catch((e) => console.warn("[bootstrap] tagDefs fetch failed:", e)),
        getTrees()
          .then((snapshot) => {
            if (mounted) setTrees(snapshot);
          })
          .catch((e) => console.warn("[bootstrap] trees fetch failed:", e)),
        isMac()
          .then((isMacValue) => {
            if (!mounted) return;
            const metaKey: MetaKeyPair = isMacValue
              ? { short: "\u2318", long: "cmd" }
              : { short: "^", long: "ctrl" };
            setPlatformMeta(metaKey, isMacValue);
          })
          .catch((e) => console.warn("[bootstrap] platform meta failed:", e)),
        getCommandState()
          .then((state) => {
            if (mounted) setCommandState(state);
          })
          .catch((e) => console.warn("[bootstrap] commandState fetch failed:", e)),
      ];
      await Promise.allSettled(deferredPromises);
      bootstrapInFlight.current = false;
    })();

    return () => {
      mounted = false;
      bootstrapInFlight.current = false;
    };
  }, [
    retryCount,
    bootstrapGraph,
    setPlatformMeta,
    setCommandState,
    setEditorMode,
    setFlags,
    setSettings,
    setTagDefs,
    setTrees,
  ]);

  return { bootstrapStatus, retryBootstrap };
}
