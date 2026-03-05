import { spotlightUsageStatsItem } from '@shared/config/storage-items.js';
import {
  emptySpotlightUsageStats,
  getSelectionFrequencyBoost,
  getSelectionTokenAffinityBoost,
  normalizeUsageQueryTokens,
  recordSpotlightSelection,
  sanitizeSpotlightUsageStats,
  type SpotlightUsageTargetStats,
} from '@shared/lib/spotlight/usage-stats.js';

export class SpotlightUsageStatsService {
  private cache = emptySpotlightUsageStats();
  private loaded = false;

  async getTargetStats(targetKey: string): Promise<SpotlightUsageTargetStats | null> {
    await this.ensureLoaded();
    return this.cache.targets[targetKey] ?? null;
  }

  async record(targetKey: string, queryTokens: string[], now = Date.now()): Promise<void> {
    await this.ensureLoaded();
    this.cache = recordSpotlightSelection(this.cache, targetKey, queryTokens, now);
    await spotlightUsageStatsItem.setValue(this.cache);
  }

  async getBoosts(targetKey: string, queryTokens: string[]): Promise<{
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

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const stored = await spotlightUsageStatsItem.getValue();
    this.cache = sanitizeSpotlightUsageStats(stored);
  }
}

export const spotlightUsageStats = new SpotlightUsageStatsService();
