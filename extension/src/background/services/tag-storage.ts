import type { Tag } from '../../shared/types/ids.js';
import type { TagDefinition } from '../../shared/types/tags.js';
import { DEFAULT_TAG_DEFS } from '../../shared/data/tag-presets.js';

const TAGS_KEY = 'trail_tag_defs' as const;
const tagArea = chrome.storage.sync;

function normalizeTagDefs(raw: unknown): TagDefinition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => item as TagDefinition)
    .filter(
      (item) =>
        typeof item.id === 'string' &&
        typeof item.label === 'string' &&
        typeof item.color === 'string' &&
        typeof item.iconId === 'string',
    )
    .map((item) => ({
      ...item,
      label: item.label.trim().slice(0, 20),
    }));
}

class TagStorageService {
  private cached: TagDefinition[] | null = null;
  private loading: Promise<TagDefinition[]> | null = null;

  async getAll(): Promise<TagDefinition[]> {
    if (this.cached) return this.cached;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        const result = await tagArea.get(TAGS_KEY);
        const raw = result[TAGS_KEY];
        let defs = normalizeTagDefs(raw);
        const merged = this.mergeDefaults(defs);
        if (merged.changed || defs.length === 0) {
          defs = merged.list;
          await tagArea.set({ [TAGS_KEY]: defs });
        } else {
          defs = merged.list;
        }
        this.cached = defs;
        return defs;
      } catch (error) {
        console.error('TagStorageService.getAll: Error loading tags:', error);
        this.cached = DEFAULT_TAG_DEFS.slice();
        return this.cached;
      } finally {
        this.loading = null;
      }
    })();

    return this.loading;
  }

  async upsert(tagDef: TagDefinition): Promise<void> {
    const defs = await this.getAll();
    const index = defs.findIndex((tag) => tag.id === tagDef.id);
    const next = [...defs];
    const normalized: TagDefinition = {
      ...tagDef,
      label: tagDef.label.trim().slice(0, 20),
    };
    if (index >= 0) {
      next[index] = normalized;
    } else {
      next.push(normalized);
    }
    this.cached = next;
    await tagArea.set({ [TAGS_KEY]: next });
  }

  async delete(tagId: Tag): Promise<void> {
    const defs = await this.getAll();
    const next = defs.filter((tag) => tag.id !== tagId);
    this.cached = next;
    await tagArea.set({ [TAGS_KEY]: next });
  }

  private mergeDefaults(defs: TagDefinition[]): { list: TagDefinition[]; changed: boolean } {
    const map = new Map<Tag, TagDefinition>();
    defs.forEach((tag) => map.set(tag.id, tag));
    let changed = false;
    for (const preset of DEFAULT_TAG_DEFS) {
      if (!map.has(preset.id)) {
        map.set(preset.id, preset);
        changed = true;
      }
    }
    const list = Array.from(map.values());
    return { list, changed };
  }
}

export const tagStorage = new TagStorageService();
