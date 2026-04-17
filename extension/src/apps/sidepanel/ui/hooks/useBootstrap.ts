import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "../../api/settings.js";
import { getFlags } from "../../api/flags.js";
import { getTreeState, getTrees } from "../../api/tree.js";
import { useStore } from "../state/store.js";

export type BootstrapStatus = "loading" | "degraded" | "ready";

const BOOTSTRAP_TIMEOUT_MS = 10_000;
const AUTO_RETRY_DELAY_MS = 5_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Bootstrap timed out")), BOOTSTRAP_TIMEOUT_MS),
    ),
  ]);
}

export function useBootstrap(): {
  bootstrapStatus: BootstrapStatus;
  retryBootstrap: () => void;
} {
  const bootstrapGraph = useStore((s) => s.bootstrapGraph);
  const setEditorMode = useStore((s) => s.setEditorMode);
  const setSettings = useStore((s) => s.setSettings);
  const setFlags = useStore((s) => s.setFlags);
  const setTrees = useStore((s) => s.setTrees);

  // Critical path: retry once after 5s, then surface as degraded.
  const settingsQ = useQuery({
    queryKey: ["bootstrap", "settings"],
    queryFn: () => withTimeout(getSettings()),
    staleTime: Infinity,
    retry: 1,
    retryDelay: AUTO_RETRY_DELAY_MS,
  });
  const treeStateQ = useQuery({
    queryKey: ["bootstrap", "treeState"],
    queryFn: () => withTimeout(getTreeState()),
    staleTime: Infinity,
    retry: 1,
    retryDelay: AUTO_RETRY_DELAY_MS,
  });
  const flagsQ = useQuery({
    queryKey: ["bootstrap", "flags"],
    queryFn: () => withTimeout(getFlags()),
    staleTime: Infinity,
    retry: 1,
    retryDelay: AUTO_RETRY_DELAY_MS,
  });

  const bootstrapStatus: BootstrapStatus =
    settingsQ.isError || treeStateQ.isError || flagsQ.isError
      ? "degraded"
      : settingsQ.data && treeStateQ.data && flagsQ.data
        ? "ready"
        : "loading";

  // Bridge critical data into the zustand store once loaded.
  useEffect(() => {
    if (settingsQ.data && treeStateQ.data && flagsQ.data) {
      bootstrapGraph(settingsQ.data, treeStateQ.data);
      setFlags(flagsQ.data);
      setSettings(settingsQ.data);
      if (treeStateQ.data.editorMode?.active) setEditorMode(treeStateQ.data.editorMode);
    }
  }, [
    settingsQ.data,
    treeStateQ.data,
    flagsQ.data,
    bootstrapGraph,
    setFlags,
    setSettings,
    setEditorMode,
  ]);

  // Deferred: non-blocking fetches after the critical path is ready.
  const enabled = bootstrapStatus === "ready";

  const treesQ = useQuery({
    queryKey: ["bootstrap", "trees"],
    queryFn: getTrees,
    enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (treesQ.data) setTrees(treesQ.data);
  }, [treesQ.data, setTrees]);

  // CommandState is no longer fetched here — it arrives as part of every
  // TREE_UPDATED message (see useRuntimeMessages).

  const retryBootstrap = useCallback(() => {
    void settingsQ.refetch();
    void treeStateQ.refetch();
    void flagsQ.refetch();
  }, [settingsQ, treeStateQ, flagsQ]);

  return { bootstrapStatus, retryBootstrap };
}
