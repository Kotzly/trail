import { spotlightUsageStatsItem } from "@shared/config/storage-items.js";
import {
  emptySpotlightUsageStats,
  getSelectionFrequencyBoost,
  getSelectionTokenAffinityBoost,
  getTopTargetKeys,
  getRecentQueries,
  normalizeUsageQueryTokens,
  recordRecentQuery,
  recordSpotlightSelection,
  sanitizeSpotlightUsageStats,
  type SpotlightUsageTargetStats,
} from "@shared/lib/spotlight/usage-stats.js";

export class SpotlightUsageStatsService {
  private cache = emptySpotlightUsageStats();
  private loadPromise: Promise<void> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  async getTargetStats(targetKey: string): Promise<SpotlightUsageTargetStats | null> {
    await this.ensureLoaded();
    return this.cache.targets[targetKey] ?? null;
  }

  async record(targetKey: string, queryTokens: string[], now = Date.now()): Promise<void> {
    await this.ensureLoaded();
    this.writeQueue = this.writeQueue.then(async () => {
      this.cache = recordSpotlightSelection(this.cache, targetKey, queryTokens, now);
      await spotlightUsageStatsItem.setValue(this.cache);
    });
    await this.writeQueue;
  }

  async getBoosts(
    targetKey: string,
    queryTokens: string[],
  ): Promise<{
    selectionFrequencyBoost: number;
    selectionTokenAffinityBoost: number;
  }> {
    await this.ensureLoaded();
    const entry = this.cache.targets[targetKey] ?? null;
    return {
      selectionFrequencyBoost: getSelectionFrequencyBoost(entry),
      selectionTokenAffinityBoost: getSelectionTokenAffinityBoost(entry, queryTokens),
    };
  }

  normalizeQueryTokens(queryTokens: string[]): string[] {
    return normalizeUsageQueryTokens(queryTokens);
  }

  async recordQuery(query: string): Promise<void> {
    await this.ensureLoaded();
    this.writeQueue = this.writeQueue.then(async () => {
      this.cache = recordRecentQuery(this.cache, query);
      await spotlightUsageStatsItem.setValue(this.cache);
    });
    await this.writeQueue;
  }

  async getRecentQueries(): Promise<string[]> {
    await this.ensureLoaded();
    return getRecentQueries(this.cache);
  }

  async getTopTargetKeys(limit: number): Promise<string[]> {
    await this.ensureLoaded();
    return getTopTargetKeys(this.cache, limit);
  }

  async clear(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      this.cache = emptySpotlightUsageStats();
      await spotlightUsageStatsItem.setValue(this.cache);
    });
    await this.writeQueue;
  }

  private ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = spotlightUsageStatsItem.getValue().then((stored) => {
        this.cache = sanitizeSpotlightUsageStats(stored);
      });
    }
    return this.loadPromise;
  }
}

export const spotlightUsageStats = new SpotlightUsageStatsService();
