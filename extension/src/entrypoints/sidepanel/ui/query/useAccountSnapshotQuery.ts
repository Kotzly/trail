import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAccountSnapshot } from "../../api/account.js";
import { accountKeys } from "./account-keys.js";
import { useStore } from "../state/store.js";
import { loadCachedSnapshotWithAge } from "../../api/account/cache.js";
import type { AccountSnapshot } from "../../../../shared/types/account.js";

const ONBOARDING_POLL_MS = 2500;
const SNAPSHOT_STALE_MS = 5 * 60_000;

type CachedInitial = {
  snapshot: AccountSnapshot;
  fetchedAt: number;
};

export function useAccountSnapshotQuery() {
  const onboardingStatus = useStore(
    (state) => state.account.onboarding.status,
  );
  const sessionStatus = useStore((state) => state.account.session.status);

  const [cached, setCached] = useState<CachedInitial | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    loadCachedSnapshotWithAge().then((envelope) => {
      if (!cancelled) {
        setCached(envelope ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useQuery({
    queryKey: accountKeys.snapshot(),
    queryFn: getAccountSnapshot,
    staleTime: SNAPSHOT_STALE_MS,
    // Use cached snapshot from chrome.storage as initial data so the
    // side panel can render immediately without a network request.
    ...(cached
      ? {
          initialData: cached.snapshot,
          initialDataUpdatedAt: cached.fetchedAt,
        }
      : {}),
    // Poll every 2.5 s while onboarding is pending so the gate closes
    // if the user completes onboarding in the web app.
    refetchInterval:
      sessionStatus === "authenticated" && onboardingStatus === "pending"
        ? ONBOARDING_POLL_MS
        : false,
    // Don't fetch while we're still loading the cache -- avoids a race
    // where the network call fires before we know if we have cached data.
    enabled: cached !== undefined,
  });
}
