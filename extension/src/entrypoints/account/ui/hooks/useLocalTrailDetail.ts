import { useQuery } from '@tanstack/react-query';
import { sendRpcMessage } from '@shared/rpc/client.js';
import { rpc, type LocalTrailDetail } from '@shared/rpc/contracts.js';

async function fetchTrailDetail(
  treeId: string,
): Promise<LocalTrailDetail> {
  const response = await sendRpcMessage(
    rpc.getLocalTrailDetail({ treeId }),
  );
  if (!response.success) {
    throw new Error(response.error);
  }
  return response.data;
}

export function useLocalTrailDetail(treeId: string | undefined) {
  const query = useQuery({
    queryKey: ['local-trail-detail', treeId],
    queryFn: () => fetchTrailDetail(treeId!),
    enabled: Boolean(treeId),
  });

  return {
    trail: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
