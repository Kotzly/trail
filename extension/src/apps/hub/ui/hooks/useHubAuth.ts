import { useQuery } from "@tanstack/react-query";
import { accountSnapshotItem } from "@shared/config/storage-items.js";

export function useHubAuth() {
  const query = useQuery({
    queryKey: ["hub-auth-status"],
    queryFn: async () => {
      const envelope = await accountSnapshotItem.getValue();
      if (!envelope) return { authenticated: false } as const;
      const { snapshot } = envelope;
      const authenticated = snapshot.session.status === "authenticated" && Boolean(snapshot.user);
      return { authenticated, user: snapshot.user } as const;
    },
  });

  return {
    authenticated: query.data?.authenticated ?? false,
    user: query.data?.user ?? null,
    isLoading: query.isLoading,
  };
}
