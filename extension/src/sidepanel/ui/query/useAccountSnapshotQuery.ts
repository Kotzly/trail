import { useQuery } from "@tanstack/react-query";
import { getAccountSnapshot } from "../../api/account.js";
import { accountKeys } from "./account-keys.js";
import { useStore } from "../state/store.js";

const ONBOARDING_POLL_MS = 2500;

export function useAccountSnapshotQuery() {
  const onboardingStatus = useStore(
    (state) => state.account.onboarding.status,
  );
  const sessionStatus = useStore((state) => state.account.session.status);

  return useQuery({
    queryKey: accountKeys.snapshot(),
    queryFn: getAccountSnapshot,
    // Poll every 2.5 s while onboarding is pending so the gate closes
    // if the user completes onboarding in the web app.
    refetchInterval:
      sessionStatus === "authenticated" && onboardingStatus === "pending"
        ? ONBOARDING_POLL_MS
        : false,
  });
}
