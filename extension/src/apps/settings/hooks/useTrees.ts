import { useEffect, useState, useCallback } from "react";
import type { TreesSnapshot } from "@shared/rpc/contracts.js";
import * as api from "../api.js";

export function useTrees() {
  const [trees, setTrees] = useState<TreesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .getTrees()
      .then(setTrees)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load trees"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const newTree = useCallback(
    async (label: string) => {
      await api.newTree(label);
      refresh();
    },
    [refresh],
  );

  const openTree = useCallback(
    async (treeId: string) => {
      await api.openTree(treeId);
      refresh();
    },
    [refresh],
  );

  const renameTree = useCallback(
    async (treeId: string, label: string) => {
      await api.renameTree(treeId, label);
      refresh();
    },
    [refresh],
  );

  const archiveActiveTree = useCallback(async () => {
    await api.archiveActiveTree();
    refresh();
  }, [refresh]);

  const deleteArchivedTree = useCallback(
    async (treeId: string) => {
      await api.deleteArchivedTree(treeId);
      refresh();
    },
    [refresh],
  );

  const exportTree = useCallback(async (treeId?: string) => {
    const bundle = await api.exportTree(treeId);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trail-export-${bundle.source.treeLabel ?? "tree"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    trees,
    loading,
    error,
    refresh,
    newTree,
    openTree,
    renameTree,
    archiveActiveTree,
    deleteArchivedTree,
    exportTree,
  };
}
