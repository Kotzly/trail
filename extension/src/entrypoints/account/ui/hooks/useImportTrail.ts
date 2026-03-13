import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendRpcMessage } from '@shared/rpc/client.js';
import { rpc } from '@shared/rpc/contracts.js';
import type { TrailExportBundle } from '@shared/types/export.js';

async function importTrail(bundle: TrailExportBundle): Promise<string> {
  const response = await sendRpcMessage(rpc.importTrail({ bundle }));
  if (!response.success) {
    throw new Error(response.error);
  }
  return response.data.treeId;
}

export function useImportTrail() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: importTrail,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['local-trails'] });
    },
  });

  return {
    importTrail: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
