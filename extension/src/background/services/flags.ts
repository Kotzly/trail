import {
  type FlagKey,
  type FlagValue,
  type ResolvedFlags,
  type PersistedFlagState,
  resolveFlags,
} from '../../shared/types/flags.js';

const STORAGE_KEY = 'trail_flags' as const;
const storage = chrome.storage.local;

class FlagManager {
  private overrides: Partial<Record<string, unknown>> = {};

  async init(): Promise<void> {
    const result = await storage.get(STORAGE_KEY).catch((error) => {
      console.error('FlagManager.init: failed to load flags:', error);
      return {};
    });
    const persisted = result[STORAGE_KEY] as PersistedFlagState | undefined;
    if (persisted && typeof persisted === 'object' && persisted.v === 1) {
      this.overrides = persisted.overrides ?? {};
    }
  }

  getAll(): ResolvedFlags {
    return resolveFlags(this.overrides);
  }

  get<K extends FlagKey>(key: K): FlagValue<K> {
    return this.getAll()[key];
  }

  async setOverride<K extends FlagKey>(key: K, value: FlagValue<K>): Promise<void> {
    this.overrides[key] = value;
    await this.persist();
  }

  async resetAll(): Promise<void> {
    this.overrides = {};
    await this.persist();
  }

  private async persist(): Promise<void> {
    const state: PersistedFlagState = { v: 1, overrides: { ...this.overrides } };
    await storage.set({ [STORAGE_KEY]: state }).catch((error) => {
      console.error('FlagManager.persist: failed to save flags:', error);
    });
  }
}

export const flagManager = new FlagManager();
flagManager.init().catch(console.error);
