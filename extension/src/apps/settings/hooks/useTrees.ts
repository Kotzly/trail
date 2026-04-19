import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../api.js";
import { decodeExport, encodeExport } from "@shared/lib/export-codec.js";

const TREES_KEY = ["trees"] as const;

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useTrees() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: TREES_KEY });

  const query = useQuery({ queryKey: TREES_KEY, queryFn: api.getTrees });

  const newTreeMutation = useMutation({
    mutationFn: api.newTree,
    onSuccess: invalidate,
    onError: (err) => toast.error("Couldn't create tree", { description: describeError(err) }),
  });
  const openTreeMutation = useMutation({
    mutationFn: api.openTree,
    onSuccess: invalidate,
    onError: (err) => toast.error("Couldn't open tree", { description: describeError(err) }),
  });
  const renameTreeMutation = useMutation({
    mutationFn: ({ treeId, label }: { treeId: string; label: string }) =>
      api.renameTree(treeId, label),
    onSuccess: invalidate,
    onError: (err) => toast.error("Couldn't rename tree", { description: describeError(err) }),
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteTree,
    onSuccess: invalidate,
    onError: (err) => toast.error("Couldn't delete tree", { description: describeError(err) }),
  });
  const downloadMutation = useMutation({
    mutationFn: api.downloadTreeLocally,
    onSuccess: () => {
      invalidate();
      toast.success("Tree downloaded to this device.");
    },
    onError: (err) => toast.error("Couldn't download tree", { description: describeError(err) }),
  });
  const unloadMutation = useMutation({
    mutationFn: api.unloadTreeToCloud,
    onSuccess: () => {
      invalidate();
      toast.success("Tree unloaded — kept in the cloud only.");
    },
    onError: (err) => toast.error("Couldn't unload tree", { description: describeError(err) }),
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
  const deleteTree = useCallback(
    (treeId: string) => deleteMutation.mutateAsync(treeId),
    [deleteMutation],
  );
  const downloadTree = useCallback(
    (treeId: string) => downloadMutation.mutateAsync(treeId),
    [downloadMutation],
  );
  const unloadTree = useCallback(
    (treeId: string) => unloadMutation.mutateAsync(treeId),
    [unloadMutation],
  );

  const exportTree = useCallback(async (treeId?: string) => {
    const bundle = await api.exportTree(treeId);
    const { bytes, suggestedFilename, mimeType } = encodeExport(bundle);
    // Wrapping Uint8Array in a plain array lets TS narrow BlobPart
    // correctly without a cast; the underlying bytes are the same.
    const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedFilename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importFromFile = useCallback(
    async (file: File) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const bundle = decodeExport(bytes);
      await api.importTrail(bundle);
      invalidate();
    },
    // invalidate is a stable reference returned by react-query's queryClient
    // method; linting it as a dep would force the caller to recreate the
    // callback every render, defeating the memoization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    trees: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: invalidate,
    newTree,
    openTree,
    renameTree,
    deleteTree,
    downloadTree,
    unloadTree,
    downloadPending: downloadMutation.isPending,
    unloadPending: unloadMutation.isPending,
    exportTree,
    importFromFile,
  };
}
