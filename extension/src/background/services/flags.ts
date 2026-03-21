import {
  type FlagKey,
  type FlagValue,
  type ResolvedFlags,
  type PersistedFlagState,
  resolveFlags,
} from "../../shared/types/flags.js";
import { flagsItem } from "@shared/config/storage-items.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("flags");

let overrides: Partial<Record<string, unknown>> = {};

export async function initFlags(): Promise<void> {
  try {
    const persisted = await flagsItem.getValue();
    if (persisted && typeof persisted === "object" && persisted.v === 1) {
      overrides = persisted.overrides ?? {};
    }
  } catch (error) {
    log.error("Failed to load flags", { error: error instanceof Error ? error.message : String(error) });
  }
}

export function getAllFlags(): ResolvedFlags {
  return resolveFlags(overrides);
}

export function getFlag<K extends FlagKey>(key: K): FlagValue<K> {
  return getAllFlags()[key];
}

export async function setFlagOverride<K extends FlagKey>(
  key: K,
  value: FlagValue<K>,
): Promise<void> {
  overrides = { ...overrides, [key]: value };
  await persistFlags();
}

export async function resetAllFlags(): Promise<void> {
  overrides = {};
  await persistFlags();
}

async function persistFlags(): Promise<void> {
  const state: PersistedFlagState = { v: 1, overrides: { ...overrides } };
  await flagsItem.setValue(state).catch((error) => {
    log.error("Failed to save flags", { error: error instanceof Error ? error.message : String(error) });
  });
}

initFlags().catch((e) => log.error("Init failed", { error: e instanceof Error ? e.message : String(e) }));
