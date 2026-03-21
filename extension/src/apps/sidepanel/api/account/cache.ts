import type { AccountSnapshot } from "@shared/types/account.js";
import {
  accountSnapshotItem,
  type CachedSnapshotEnvelope,
} from "../../../../shared/config/storage-items.js";

// Re-export so existing callers that import the type from here keep working.
export type { CachedSnapshotEnvelope };

export async function loadCachedSnapshotWithAge(): Promise<CachedSnapshotEnvelope | null> {
  const stored = await accountSnapshotItem.getValue();
  if (!stored || !stored.snapshot || typeof stored.fetchedAt !== "number") {
    return null;
  }
  return stored;
}

export async function loadCachedSnapshot(): Promise<AccountSnapshot | null> {
  const envelope = await loadCachedSnapshotWithAge();
  return envelope?.snapshot ?? null;
}

export async function saveCachedSnapshot(snapshot: AccountSnapshot): Promise<void> {
  const envelope: CachedSnapshotEnvelope = { snapshot, fetchedAt: Date.now() };
  await accountSnapshotItem.setValue(envelope);
}

export async function clearCachedSnapshot(): Promise<void> {
  await accountSnapshotItem.removeValue();
}
