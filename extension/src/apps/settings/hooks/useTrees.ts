import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api.js";

const TREES_KEY = ["trees"] as const;

export function useTrees() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: TREES_KEY });

  const query = useQuery({ queryKey: TREES_KEY, queryFn: api.getTrees });

  const newTreeMutation = useMutation({ mutationFn: api.newTree, onSuccess: invalidate });
  const openTreeMutation = useMutation({ mutationFn: api.openTree, onSuccess: invalidate });
  const renameTreeMutation = useMutation({
    mutationFn: ({ treeId, label }: { treeId: string; label: string }) =>
      api.renameTree(treeId, label),
    onSuccess: invalidate,
  });
  const archiveMutation = useMutation({ mutationFn: api.archiveActiveTree, onSuccess: invalidate });
  const deleteMutation = useMutation({
    mutationFn: api.deleteArchivedTree,
    onSuccess: invalidate,
  });

  const newTree = useCallback(
    (label: string) => newTreeMutation.mutateAsync(label),
    [newTreeMutation],
  );
  const openTree = useCallback(
    (treeId: string) => openTreeMutation.mutateAsync(treeId),
    [openTreeMutation],
  );
  const renameTree = useCallback(
    (treeId: string, label: string) => renameTreeMutation.mutateAsync({ treeId, label }),
    [renameTreeMutation],
  );
  const archiveActiveTree = useCallback(() => archiveMutation.mutateAsync(), [archiveMutation]);
  const deleteArchivedTree = useCallback(
    (treeId: string) => deleteMutation.mutateAsync(treeId),
    [deleteMutation],
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
    trees: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: invalidate,
    newTree,
    openTree,
    renameTree,
    archiveActiveTree,
    deleteArchivedTree,
    exportTree,
  };
}
