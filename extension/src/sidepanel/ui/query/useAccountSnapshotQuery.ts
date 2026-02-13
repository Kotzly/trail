import { useQuery } from "@tanstack/react-query";
import { getAccountSnapshot } from "../../api/account.js";
import { accountKeys } from "./account-keys.js";

export function useAccountSnapshotQuery() {
  return useQuery({
    queryKey: accountKeys.snapshot(),
    queryFn: getAccountSnapshot,
  });
}
